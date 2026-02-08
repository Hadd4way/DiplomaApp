"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBooks = listBooks;
exports.addSampleBook = addSampleBook;
exports.importBook = importBook;
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
