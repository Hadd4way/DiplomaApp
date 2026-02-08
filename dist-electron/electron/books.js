"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBooks = listBooks;
exports.addSampleBook = addSampleBook;
exports.importBook = importBook;
exports.revealBook = revealBook;
exports.deleteBook = deleteBook;
exports.getPdfData = getPdfData;
const node_crypto_1 = require("node:crypto");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
const auth_1 = require("./auth");
function toBook(row) {
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
function extensionToFormat(fileExtension) {
    const ext = fileExtension.toLowerCase();
    if (ext === '.pdf') {
        return 'pdf';
    }
    if (ext === '.epub') {
        return 'epub';
    }
    return null;
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
function listBooks(db, payload) {
    const session = (0, auth_1.resolveSessionUserId)(db, payload.token);
    if (!session.ok) {
        return session;
    }
    const rows = db
        .prepare(`SELECT id, user_id, title, author, format, file_path, created_at
       FROM books
       WHERE user_id = ?
       ORDER BY created_at DESC`)
        .all(session.userId);
    return {
        ok: true,
        books: rows.map(toBook)
    };
}
function addSampleBook(db, payload) {
    const session = (0, auth_1.resolveSessionUserId)(db, payload.token);
    if (!session.ok) {
        return session;
    }
    const sampleCountRow = db
        .prepare('SELECT COUNT(*) AS count FROM books WHERE user_id = ?')
        .get(session.userId);
    const sampleNumber = sampleCountRow.count + 1;
    const format = sampleNumber % 2 === 1 ? 'pdf' : 'epub';
    const now = Date.now();
    const book = {
        id: (0, node_crypto_1.randomUUID)(),
        userId: session.userId,
        title: `Sample Book ${sampleNumber}`,
        author: null,
        format,
        filePath: null,
        createdAt: now
    };
    db.prepare(`INSERT INTO books (id, user_id, title, author, format, file_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`).run(book.id, book.userId, book.title, book.author, book.format, book.filePath, book.createdAt);
    return { ok: true, book };
}
async function importBook(db, payload, userDataPath, ownerWindow) {
    const session = (0, auth_1.resolveSessionUserId)(db, payload.token);
    if (!session.ok) {
        return session;
    }
    const dialogOptions = {
        title: 'Import book',
        properties: ['openFile'],
        filters: [
            { name: 'Books', extensions: ['pdf', 'epub'] },
            { name: 'PDF', extensions: ['pdf'] },
            { name: 'EPUB', extensions: ['epub'] }
        ]
    };
    const pickerResult = ownerWindow
        ? await electron_1.dialog.showOpenDialog(ownerWindow, dialogOptions)
        : await electron_1.dialog.showOpenDialog(dialogOptions);
    if (pickerResult.canceled || pickerResult.filePaths.length === 0) {
        return { ok: false, error: 'Import canceled.' };
    }
    const sourcePath = pickerResult.filePaths[0];
    const sourceExtension = node_path_1.default.extname(sourcePath);
    const format = extensionToFormat(sourceExtension);
    if (!format) {
        return { ok: false, error: 'Unsupported file type. Please choose a PDF or EPUB file.' };
    }
    const bookId = (0, node_crypto_1.randomUUID)();
    const now = Date.now();
    const extension = format === 'pdf' ? 'pdf' : 'epub';
    const filename = `original.${extension}`;
    const targetDir = node_path_1.default.join(userDataPath, 'books', bookId);
    const targetPath = node_path_1.default.join(targetDir, filename);
    const titleFromFile = node_path_1.default.basename(sourcePath, sourceExtension).trim();
    try {
        await promises_1.default.mkdir(targetDir, { recursive: true });
        await promises_1.default.copyFile(sourcePath, targetPath);
    }
    catch {
        return { ok: false, error: 'Failed to copy the selected file.' };
    }
    const book = {
        id: bookId,
        userId: session.userId,
        title: titleFromFile || `Imported ${format.toUpperCase()}`,
        author: null,
        format,
        filePath: targetPath,
        createdAt: now
    };
    try {
        db.prepare(`INSERT INTO books (id, user_id, title, author, format, file_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(book.id, book.userId, book.title, book.author, book.format, book.filePath, book.createdAt);
    }
    catch {
        return { ok: false, error: 'Failed to save imported book metadata.' };
    }
    return { ok: true, book };
}
async function revealBook(db, payload, userDataPath) {
    const session = (0, auth_1.resolveSessionUserId)(db, payload.token);
    if (!session.ok) {
        return session;
    }
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const bookRow = db
        .prepare('SELECT id, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, session.userId);
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
async function deleteBook(db, payload, userDataPath) {
    const session = (0, auth_1.resolveSessionUserId)(db, payload.token);
    if (!session.ok) {
        return session;
    }
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const bookRow = db
        .prepare('SELECT id, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, session.userId);
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
        .run(bookId, session.userId);
    if (deleteResult.changes === 0) {
        return { ok: false, error: 'Book not found' };
    }
    return { ok: true };
}
async function getPdfData(db, payload) {
    const session = (0, auth_1.resolveSessionUserId)(db, payload.token);
    if (!session.ok) {
        return session;
    }
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const bookRow = db
        .prepare('SELECT id, title, format, file_path FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, session.userId);
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
