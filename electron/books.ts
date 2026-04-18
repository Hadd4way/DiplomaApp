import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { dialog, shell, type BrowserWindow, type OpenDialogOptions } from 'electron';
import type Database from 'better-sqlite3';
import type {
  Book,
  BookFormat,
  BooksAddSampleResult,
  BooksDeleteRequest,
  BooksDeleteResult,
  BooksGetEpubDataRequest,
  BooksGetEpubDataResult,
  BooksGetFb2DataRequest,
  BooksGetFb2DataResult,
  BooksGetPdfDataRequest,
  BooksGetPdfDataResult,
  BooksImportResult,
  BooksRevealRequest,
  BooksRevealResult,
  BooksListResult
} from '../shared/ipc';

type BookRow = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  format: 'pdf' | 'epub' | 'fb2';
  file_path: string | null;
  created_at: number;
};

function toBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    format: row.format,
    filePath: row.file_path,
    createdAt: row.created_at
  };
}

function extensionToFormat(fileExtension: string): BookFormat | null {
  const ext = fileExtension.toLowerCase();
  if (ext === '.pdf') {
    return 'pdf';
  }
  if (ext === '.epub') {
    return 'epub';
  }
  if (ext === '.fb2') {
    return 'fb2';
  }
  return null;
}

function detectXmlEncoding(buffer: Buffer): string {
  const asciiHead = buffer.subarray(0, Math.min(buffer.length, 512)).toString('latin1');
  const match = asciiHead.match(/encoding\s*=\s*["']([^"']+)["']/i);
  return match?.[1]?.trim() || 'utf-8';
}

function decodeXmlBuffer(buffer: Buffer): string {
  const candidates = [detectXmlEncoding(buffer), 'utf-8', 'windows-1251'];
  for (const candidate of candidates) {
    try {
      return new TextDecoder(candidate, { fatal: false }).decode(buffer);
    } catch {
    }
  }
  return buffer.toString('utf8');
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripXml(value: string): string {
  return decodeXmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function extractTagContent(source: string, tagName: string): string | null {
  const match = source.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
  if (!match?.[1]) {
    return null;
  }
  const normalized = stripXml(match[1]);
  return normalized || null;
}

function extractFb2Metadata(xml: string): { title: string | null; author: string | null } {
  const titleInfoMatch = xml.match(/<title-info\b[^>]*>([\s\S]*?)<\/title-info>/i);
  const titleInfo = titleInfoMatch?.[1] ?? xml;
  const title = extractTagContent(titleInfo, 'book-title');

  const authorMatch = titleInfo.match(/<author\b[^>]*>([\s\S]*?)<\/author>/i);
  const authorMarkup = authorMatch?.[1] ?? '';
  const authorParts = [
    extractTagContent(authorMarkup, 'first-name'),
    extractTagContent(authorMarkup, 'middle-name'),
    extractTagContent(authorMarkup, 'last-name')
  ].filter((part): part is string => Boolean(part));
  const nickname = extractTagContent(authorMarkup, 'nickname');
  const author = authorParts.join(' ').trim() || nickname || null;

  return { title, author };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function listBooks(db: Database.Database, userId: string): BooksListResult {
  const rows = db
    .prepare(
      `SELECT id, user_id, title, author, format, file_path, created_at
       FROM books
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId) as BookRow[];

  return {
    ok: true,
    books: rows.map(toBook)
  };
}

export function addSampleBook(
  db: Database.Database,
  userId: string
): BooksAddSampleResult {
  const sampleCountRow = db
    .prepare('SELECT COUNT(*) AS count FROM books WHERE user_id = ?')
    .get(userId) as { count: number };

  const sampleNumber = sampleCountRow.count + 1;
  const format: BookFormat = sampleNumber % 2 === 1 ? 'pdf' : 'epub';
  const now = Date.now();
  const book: Book = {
    id: randomUUID(),
    title: `Sample Book ${sampleNumber}`,
    author: null,
    format,
    filePath: null,
    createdAt: now
  };

  db.prepare(
    `INSERT INTO books (id, user_id, title, author, format, file_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(book.id, userId, book.title, book.author, book.format, book.filePath, book.createdAt);

  return { ok: true, book };
}

export async function importBook(
  db: Database.Database,
  userId: string,
  userDataPath: string,
  ownerWindow: BrowserWindow | null
): Promise<BooksImportResult> {
  const dialogOptions: OpenDialogOptions = {
    title: 'Import book',
    properties: ['openFile'],
    filters: [
      { name: 'Books', extensions: ['pdf', 'epub', 'fb2'] },
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'EPUB', extensions: ['epub'] },
      { name: 'FB2', extensions: ['fb2'] }
    ]
  };

  const pickerResult = ownerWindow
    ? await dialog.showOpenDialog(ownerWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (pickerResult.canceled || pickerResult.filePaths.length === 0) {
    return { ok: false, error: 'Import canceled.' };
  }

  const sourcePath = pickerResult.filePaths[0];
  const sourceExtension = path.extname(sourcePath);
  const format = extensionToFormat(sourceExtension);
  if (!format) {
    return { ok: false, error: 'Unsupported file type. Please choose a PDF, EPUB, or FB2 file.' };
  }

  const bookId = randomUUID();
  const now = Date.now();
  const extension = format;
  const filename = `original.${extension}`;
  const targetDir = path.join(userDataPath, 'books', bookId);
  const targetPath = path.join(targetDir, filename);
  let titleFromFile = path.basename(sourcePath, sourceExtension).trim();
  let authorFromFile: string | null = null;

  try {
    await fs.mkdir(targetDir, { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
    if (format === 'fb2') {
      const fileBuffer = await fs.readFile(sourcePath);
      const xml = decodeXmlBuffer(fileBuffer);
      const metadata = extractFb2Metadata(xml);
      if (metadata.title) {
        titleFromFile = metadata.title;
      }
      authorFromFile = metadata.author;
    }
  } catch {
    return { ok: false, error: 'Failed to copy the selected file.' };
  }

  const book: Book = {
    id: bookId,
    title: titleFromFile || `Imported ${format.toUpperCase()}`,
    author: authorFromFile,
    format,
    filePath: targetPath,
    createdAt: now
  };

  try {
    db.prepare(
      `INSERT INTO books (id, user_id, title, author, format, file_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(book.id, userId, book.title, book.author, book.format, book.filePath, book.createdAt);
  } catch {
    return { ok: false, error: 'Failed to save imported book metadata.' };
  }

  return { ok: true, book };
}

export async function revealBook(
  db: Database.Database,
  userId: string,
  payload: BooksRevealRequest,
  userDataPath: string
): Promise<BooksRevealResult> {
  const bookId = payload.bookId?.trim();
  if (!bookId) {
    return { ok: false, error: 'Book not found' };
  }

  const bookRow = db
    .prepare('SELECT id, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
    .get(bookId, userId) as { id: string; file_path: string | null } | undefined;

  if (!bookRow) {
    return { ok: false, error: 'Book not found' };
  }

  const fallbackFolderPath = path.join(userDataPath, 'books', bookId);
  const dbFilePath = bookRow.file_path?.trim() || null;

  if (dbFilePath && (await pathExists(dbFilePath))) {
    shell.showItemInFolder(dbFilePath);
    return { ok: true };
  }

  if (!(await pathExists(fallbackFolderPath))) {
    return { ok: false, error: 'Book file or folder is missing.' };
  }

  const openError = await shell.openPath(fallbackFolderPath);
  if (openError) {
    return { ok: false, error: 'Failed to open book folder.' };
  }

  return { ok: true };
}

export async function deleteBook(
  db: Database.Database,
  userId: string,
  payload: BooksDeleteRequest,
  userDataPath: string
): Promise<BooksDeleteResult> {
  const bookId = payload.bookId?.trim();
  if (!bookId) {
    return { ok: false, error: 'Book not found' };
  }

  const bookRow = db
    .prepare('SELECT id, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
    .get(bookId, userId) as { id: string; file_path: string | null } | undefined;

  if (!bookRow) {
    return { ok: false, error: 'Book not found' };
  }

  const preferredFolderPath = path.join(userDataPath, 'books', bookId);
  const normalizedPreferredFolder = path.resolve(preferredFolderPath);

  const filePath = bookRow.file_path?.trim() || null;
  if (filePath) {
    const normalizedFilePath = path.resolve(filePath);
    if (!normalizedFilePath.startsWith(normalizedPreferredFolder + path.sep)) {
      // Ignore unexpected external path and still operate on the managed storage folder.
    }
  }

  try {
    await fs.rm(preferredFolderPath, { recursive: true, force: true });
  } catch {
    return {
      ok: false,
      error: 'Failed to delete local files. Close any app using this file and try again.'
    };
  }

  const deleteResult = db
    .prepare('DELETE FROM books WHERE id = ? AND user_id = ?')
    .run(bookId, userId);

  if (deleteResult.changes === 0) {
    return { ok: false, error: 'Book not found' };
  }

  db.prepare('DELETE FROM reading_stats WHERE book_id = ?').run(bookId);

  return { ok: true };
}

export async function getPdfData(
  db: Database.Database,
  userId: string,
  payload: BooksGetPdfDataRequest
): Promise<BooksGetPdfDataResult> {
  const bookId = payload.bookId?.trim();
  if (!bookId) {
    return { ok: false, error: 'Book not found' };
  }

  const bookRow = db
    .prepare('SELECT id, title, format, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
    .get(bookId, userId) as
    | { id: string; title: string; format: 'pdf' | 'epub' | 'fb2'; file_path: string | null }
    | undefined;

  if (!bookRow) {
    return { ok: false, error: 'Book not found' };
  }

  if (bookRow.format !== 'pdf') {
    return { ok: false, error: 'Selected book is not a PDF.' };
  }

  const pdfPath = bookRow.file_path?.trim();
  if (!pdfPath) {
    return { ok: false, error: 'PDF file path is missing.' };
  }

  try {
    const fileBuffer = await fs.readFile(pdfPath);
    return {
      ok: true,
      base64: fileBuffer.toString('base64'),
      title: bookRow.title
    };
  } catch {
    return { ok: false, error: 'Failed to read PDF file from disk.' };
  }
}

export async function getEpubData(
  db: Database.Database,
  userId: string,
  payload: BooksGetEpubDataRequest
): Promise<BooksGetEpubDataResult> {
  const bookId = payload.bookId?.trim();
  if (!bookId) {
    return { ok: false, error: 'Book not found' };
  }

  const bookRow = db
    .prepare('SELECT id, title, format, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
    .get(bookId, userId) as
    | { id: string; title: string; format: 'pdf' | 'epub' | 'fb2'; file_path: string | null }
    | undefined;

  if (!bookRow) {
    return { ok: false, error: 'Book not found' };
  }

  if (bookRow.format !== 'epub') {
    return { ok: false, error: 'Selected book is not an EPUB.' };
  }

  const epubPath = bookRow.file_path?.trim();
  if (!epubPath) {
    return { ok: false, error: 'EPUB file path is missing.' };
  }

  try {
    const fileBuffer = await fs.readFile(epubPath);
    return {
      ok: true,
      base64: fileBuffer.toString('base64'),
      title: bookRow.title
    };
  } catch {
    return { ok: false, error: 'Failed to read EPUB file from disk.' };
  }
}

export async function getFb2Data(
  db: Database.Database,
  userId: string,
  payload: BooksGetFb2DataRequest
): Promise<BooksGetFb2DataResult> {
  const bookId = payload.bookId?.trim();
  if (!bookId) {
    return { ok: false, error: 'Book not found' };
  }

  const bookRow = db
    .prepare('SELECT id, title, format, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
    .get(bookId, userId) as
    | { id: string; title: string; format: 'pdf' | 'epub' | 'fb2'; file_path: string | null }
    | undefined;

  if (!bookRow) {
    return { ok: false, error: 'Book not found' };
  }

  if (bookRow.format !== 'fb2') {
    return { ok: false, error: 'Selected book is not an FB2 file.' };
  }

  const fb2Path = bookRow.file_path?.trim();
  if (!fb2Path) {
    return { ok: false, error: 'FB2 file path is missing.' };
  }

  try {
    const fileBuffer = await fs.readFile(fb2Path);
    return {
      ok: true,
      content: decodeXmlBuffer(fileBuffer),
      title: bookRow.title
    };
  } catch {
    return { ok: false, error: 'Failed to read FB2 file from disk.' };
  }
}
