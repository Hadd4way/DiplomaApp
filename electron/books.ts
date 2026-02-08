import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { dialog, type BrowserWindow, type OpenDialogOptions } from 'electron';
import type Database from 'better-sqlite3';
import type {
  Book,
  BookFormat,
  BooksAddSampleRequest,
  BooksAddSampleResult,
  BooksImportRequest,
  BooksImportResult,
  BooksListRequest,
  BooksListResult
} from '../shared/ipc';
import { resolveSessionUserId } from './auth';

type BookRow = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  format: 'pdf' | 'epub';
  file_path: string | null;
  created_at: number;
};

function toBook(row: BookRow): Book {
  return {
    id: row.id,
    userId: row.user_id,
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
  return null;
}

export function listBooks(db: Database.Database, payload: BooksListRequest): BooksListResult {
  const session = resolveSessionUserId(db, payload.token);
  if (!session.ok) {
    return session;
  }

  const rows = db
    .prepare(
      `SELECT id, user_id, title, author, format, file_path, created_at
       FROM books
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .all(session.userId) as BookRow[];

  return {
    ok: true,
    books: rows.map(toBook)
  };
}

export function addSampleBook(
  db: Database.Database,
  payload: BooksAddSampleRequest
): BooksAddSampleResult {
  const session = resolveSessionUserId(db, payload.token);
  if (!session.ok) {
    return session;
  }

  const sampleCountRow = db
    .prepare('SELECT COUNT(*) AS count FROM books WHERE user_id = ?')
    .get(session.userId) as { count: number };

  const sampleNumber = sampleCountRow.count + 1;
  const format: BookFormat = sampleNumber % 2 === 1 ? 'pdf' : 'epub';
  const now = Date.now();
  const book: Book = {
    id: randomUUID(),
    userId: session.userId,
    title: `Sample Book ${sampleNumber}`,
    author: null,
    format,
    filePath: null,
    createdAt: now
  };

  db.prepare(
    `INSERT INTO books (id, user_id, title, author, format, file_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(book.id, book.userId, book.title, book.author, book.format, book.filePath, book.createdAt);

  return { ok: true, book };
}

export async function importBook(
  db: Database.Database,
  payload: BooksImportRequest,
  userDataPath: string,
  ownerWindow: BrowserWindow | null
): Promise<BooksImportResult> {
  const session = resolveSessionUserId(db, payload.token);
  if (!session.ok) {
    return session;
  }

  const dialogOptions: OpenDialogOptions = {
    title: 'Import book',
    properties: ['openFile'],
    filters: [
      { name: 'Books', extensions: ['pdf', 'epub'] },
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'EPUB', extensions: ['epub'] }
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
    return { ok: false, error: 'Unsupported file type. Please choose a PDF or EPUB file.' };
  }

  const bookId = randomUUID();
  const now = Date.now();
  const extension = format === 'pdf' ? 'pdf' : 'epub';
  const filename = `original.${extension}`;
  const targetDir = path.join(userDataPath, 'books', bookId);
  const targetPath = path.join(targetDir, filename);
  const titleFromFile = path.basename(sourcePath, sourceExtension).trim();

  try {
    await fs.mkdir(targetDir, { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  } catch {
    return { ok: false, error: 'Failed to copy the selected file.' };
  }

  const book: Book = {
    id: bookId,
    userId: session.userId,
    title: titleFromFile || `Imported ${format.toUpperCase()}`,
    author: null,
    format,
    filePath: targetPath,
    createdAt: now
  };

  try {
    db.prepare(
      `INSERT INTO books (id, user_id, title, author, format, file_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(book.id, book.userId, book.title, book.author, book.format, book.filePath, book.createdAt);
  } catch {
    return { ok: false, error: 'Failed to save imported book metadata.' };
  }

  return { ok: true, book };
}
