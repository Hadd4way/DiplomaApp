"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBooks = listBooks;
exports.addSampleBook = addSampleBook;
const node_crypto_1 = require("node:crypto");
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
