"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBooks = listBooks;
exports.addSampleBook = addSampleBook;
exports.importBook = importBook;
exports.importBookFromPath = importBookFromPath;
exports.revealBook = revealBook;
exports.deleteBook = deleteBook;
exports.getPdfData = getPdfData;
exports.getEpubData = getEpubData;
exports.getFb2Data = getFb2Data;
exports.getTxtData = getTxtData;
const node_crypto_1 = require("node:crypto");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
function toBook(row) {
    return {
        id: row.id,
        title: row.title,
        author: row.author,
        format: row.format,
        filePath: row.file_path,
        createdAt: row.created_at
    };
}
function extensionToFormat(fileExtension) {
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
    if (ext === '.txt') {
        return 'txt';
    }
    return null;
}
function getImportedBookTargetPaths(userDataPath, bookId, format) {
    const targetDir = node_path_1.default.join(userDataPath, 'books', bookId);
    const filename = `original.${format}`;
    return {
        targetDir,
        targetPath: node_path_1.default.join(targetDir, filename)
    };
}
function detectXmlEncoding(buffer) {
    const asciiHead = buffer.subarray(0, Math.min(buffer.length, 512)).toString('latin1');
    const match = asciiHead.match(/encoding\s*=\s*["']([^"']+)["']/i);
    return match?.[1]?.trim() || 'utf-8';
}
function decodeXmlBuffer(buffer) {
    const candidates = [detectXmlEncoding(buffer), 'utf-8', 'windows-1251'];
    for (const candidate of candidates) {
        try {
            return new TextDecoder(candidate, { fatal: false }).decode(buffer);
        }
        catch {
        }
    }
    return buffer.toString('utf8');
}
function stripUtf8Bom(value) {
    return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
function tryDecode(buffer, encoding, fatal = true) {
    try {
        return stripUtf8Bom(new TextDecoder(encoding, { fatal }).decode(buffer));
    }
    catch {
        return null;
    }
}
function decodeTxtBuffer(buffer) {
    const hasUtf16LeBom = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;
    const hasUtf16BeBom = buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff;
    if (hasUtf16LeBom) {
        return tryDecode(buffer, 'utf-16le', false) ?? tryDecode(buffer, 'utf-8', true) ?? buffer.toString('utf8');
    }
    if (hasUtf16BeBom) {
        return tryDecode(buffer, 'utf-16be', false) ?? tryDecode(buffer, 'utf-8', true) ?? buffer.toString('utf8');
    }
    return (tryDecode(buffer, 'utf-8', true) ??
        tryDecode(buffer, 'windows-1251', false) ??
        tryDecode(buffer, 'koi8-r', false) ??
        tryDecode(buffer, 'utf-16le', false) ??
        stripUtf8Bom(buffer.toString('utf8')));
}
function decodeXmlEntities(value) {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}
function stripXml(value) {
    return decodeXmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}
function extractTagContent(source, tagName) {
    const match = source.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
    if (!match?.[1]) {
        return null;
    }
    const normalized = stripXml(match[1]);
    return normalized || null;
}
function extractFb2Metadata(xml) {
    const titleInfoMatch = xml.match(/<title-info\b[^>]*>([\s\S]*?)<\/title-info>/i);
    const titleInfo = titleInfoMatch?.[1] ?? xml;
    const title = extractTagContent(titleInfo, 'book-title');
    const authorMatch = titleInfo.match(/<author\b[^>]*>([\s\S]*?)<\/author>/i);
    const authorMarkup = authorMatch?.[1] ?? '';
    const authorParts = [
        extractTagContent(authorMarkup, 'first-name'),
        extractTagContent(authorMarkup, 'middle-name'),
        extractTagContent(authorMarkup, 'last-name')
    ].filter((part) => Boolean(part));
    const nickname = extractTagContent(authorMarkup, 'nickname');
    const author = authorParts.join(' ').trim() || nickname || null;
    return { title, author };
}
async function pathExists(targetPath) {
    try {
        await promises_1.default.access(targetPath);
        return true;
    }
    catch {
        return false;
    }
}
function listBooks(db, userId) {
    const rows = db
        .prepare(`SELECT id, user_id, title, author, format, file_path, created_at
       FROM books
       WHERE user_id = ?
       ORDER BY created_at DESC`)
        .all(userId);
    return {
        ok: true,
        books: rows.map(toBook)
    };
}
function addSampleBook(db, userId) {
    const sampleCountRow = db
        .prepare('SELECT COUNT(*) AS count FROM books WHERE user_id = ?')
        .get(userId);
    const sampleNumber = sampleCountRow.count + 1;
    const format = sampleNumber % 2 === 1 ? 'pdf' : 'epub';
    const now = Date.now();
    const book = {
        id: (0, node_crypto_1.randomUUID)(),
        title: `Sample Book ${sampleNumber}`,
        author: null,
        format,
        filePath: null,
        createdAt: now
    };
    db.prepare(`INSERT INTO books (id, user_id, title, author, format, file_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`).run(book.id, userId, book.title, book.author, book.format, book.filePath, book.createdAt);
    return { ok: true, book };
}
async function importBook(db, userId, userDataPath, ownerWindow) {
    const dialogOptions = {
        title: 'Import book',
        properties: ['openFile'],
        filters: [
            { name: 'Books', extensions: ['pdf', 'epub', 'fb2', 'txt'] },
            { name: 'PDF', extensions: ['pdf'] },
            { name: 'EPUB', extensions: ['epub'] },
            { name: 'FB2', extensions: ['fb2'] },
            { name: 'TXT', extensions: ['txt'] }
        ]
    };
    const pickerResult = ownerWindow
        ? await electron_1.dialog.showOpenDialog(ownerWindow, dialogOptions)
        : await electron_1.dialog.showOpenDialog(dialogOptions);
    if (pickerResult.canceled || pickerResult.filePaths.length === 0) {
        return { ok: false, error: 'Import canceled.' };
    }
    const sourcePath = pickerResult.filePaths[0];
    return importBookFromPath(db, userId, userDataPath, sourcePath);
}
async function importBookFromPath(db, userId, userDataPath, sourcePath, metadata = {}) {
    const sourceExtension = node_path_1.default.extname(sourcePath);
    const format = extensionToFormat(sourceExtension);
    if (!format) {
        return { ok: false, error: 'Unsupported file type. Please choose a PDF, EPUB, FB2, or TXT file.' };
    }
    const bookId = (0, node_crypto_1.randomUUID)();
    const now = Date.now();
    const { targetDir, targetPath } = getImportedBookTargetPaths(userDataPath, bookId, format);
    let titleFromFile = metadata.title?.trim() || node_path_1.default.basename(sourcePath, sourceExtension).trim();
    let authorFromFile = metadata.author?.trim() || null;
    try {
        await promises_1.default.mkdir(targetDir, { recursive: true });
        await promises_1.default.copyFile(sourcePath, targetPath);
        if (format === 'fb2') {
            const fileBuffer = await promises_1.default.readFile(sourcePath);
            const xml = decodeXmlBuffer(fileBuffer);
            const metadata = extractFb2Metadata(xml);
            if (metadata.title) {
                titleFromFile = metadata.title;
            }
            authorFromFile = metadata.author ?? authorFromFile;
        }
    }
    catch {
        return { ok: false, error: 'Failed to copy the selected file.' };
    }
    const book = {
        id: bookId,
        title: titleFromFile || `Imported ${format.toUpperCase()}`,
        author: authorFromFile,
        format,
        filePath: targetPath,
        createdAt: now
    };
    try {
        db.prepare(`INSERT INTO books (id, user_id, title, author, format, file_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(book.id, userId, book.title, book.author, book.format, book.filePath, book.createdAt);
    }
    catch {
        return { ok: false, error: 'Failed to save imported book metadata.' };
    }
    return { ok: true, book };
}
async function revealBook(db, userId, payload, userDataPath) {
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const bookRow = db
        .prepare('SELECT id, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, userId);
    if (!bookRow) {
        return { ok: false, error: 'Book not found' };
    }
    const fallbackFolderPath = node_path_1.default.join(userDataPath, 'books', bookId);
    const dbFilePath = bookRow.file_path?.trim() || null;
    if (dbFilePath && (await pathExists(dbFilePath))) {
        electron_1.shell.showItemInFolder(dbFilePath);
        return { ok: true };
    }
    if (!(await pathExists(fallbackFolderPath))) {
        return { ok: false, error: 'Book file or folder is missing.' };
    }
    const openError = await electron_1.shell.openPath(fallbackFolderPath);
    if (openError) {
        return { ok: false, error: 'Failed to open book folder.' };
    }
    return { ok: true };
}
async function deleteBook(db, userId, payload, userDataPath) {
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const bookRow = db
        .prepare('SELECT id, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, userId);
    if (!bookRow) {
        return { ok: false, error: 'Book not found' };
    }
    const preferredFolderPath = node_path_1.default.join(userDataPath, 'books', bookId);
    const normalizedPreferredFolder = node_path_1.default.resolve(preferredFolderPath);
    const filePath = bookRow.file_path?.trim() || null;
    if (filePath) {
        const normalizedFilePath = node_path_1.default.resolve(filePath);
        if (!normalizedFilePath.startsWith(normalizedPreferredFolder + node_path_1.default.sep)) {
            // Ignore unexpected external path and still operate on the managed storage folder.
        }
    }
    try {
        await promises_1.default.rm(preferredFolderPath, { recursive: true, force: true });
    }
    catch {
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
async function getPdfData(db, userId, payload) {
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const bookRow = db
        .prepare('SELECT id, title, format, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, userId);
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
        const fileBuffer = await promises_1.default.readFile(pdfPath);
        return {
            ok: true,
            base64: fileBuffer.toString('base64'),
            title: bookRow.title
        };
    }
    catch {
        return { ok: false, error: 'Failed to read PDF file from disk.' };
    }
}
async function getEpubData(db, userId, payload) {
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const bookRow = db
        .prepare('SELECT id, title, format, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, userId);
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
        const fileBuffer = await promises_1.default.readFile(epubPath);
        return {
            ok: true,
            base64: fileBuffer.toString('base64'),
            title: bookRow.title
        };
    }
    catch {
        return { ok: false, error: 'Failed to read EPUB file from disk.' };
    }
}
async function getFb2Data(db, userId, payload) {
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const bookRow = db
        .prepare('SELECT id, title, format, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, userId);
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
        const fileBuffer = await promises_1.default.readFile(fb2Path);
        return {
            ok: true,
            content: decodeXmlBuffer(fileBuffer),
            title: bookRow.title
        };
    }
    catch {
        return { ok: false, error: 'Failed to read FB2 file from disk.' };
    }
}
async function getTxtData(db, userId, payload) {
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const bookRow = db
        .prepare('SELECT id, title, format, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, userId);
    if (!bookRow) {
        return { ok: false, error: 'Book not found' };
    }
    if (bookRow.format !== 'txt') {
        return { ok: false, error: 'Selected book is not a TXT file.' };
    }
    const txtPath = bookRow.file_path?.trim();
    if (!txtPath) {
        return { ok: false, error: 'TXT file path is missing.' };
    }
    try {
        const fileBuffer = await promises_1.default.readFile(txtPath);
        return {
            ok: true,
            content: decodeTxtBuffer(fileBuffer),
            title: bookRow.title
        };
    }
    catch {
        return { ok: false, error: 'Failed to read TXT file from disk.' };
    }
}
