"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNote = createNote;
exports.listNotes = listNotes;
exports.deleteNote = deleteNote;
exports.updateNote = updateNote;
const node_crypto_1 = require("node:crypto");
function isValidPage(page) {
    return Number.isFinite(page) && Math.floor(page) >= 1;
}
function createNote(authDb, readerDb, userId, payload) {
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    if (!isValidPage(payload.page)) {
        return { ok: false, error: 'Invalid page' };
    }
    const content = payload.content?.trim();
    if (!content) {
        return { ok: false, error: 'Note content is required.' };
    }
    const ownedBook = authDb
        .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, userId);
    if (!ownedBook) {
        return { ok: false, error: 'Book not found' };
    }
    const now = Date.now();
    const note = {
        id: (0, node_crypto_1.randomUUID)(),
        bookId,
        page: Math.floor(payload.page),
        content,
        createdAt: now,
        updatedAt: now
    };
    const created = readerDb.createNote(userId, note);
    if (!created) {
        return { ok: false, error: 'Failed to create note.' };
    }
    return { ok: true, note: created };
}
function listNotes(authDb, readerDb, userId, payload) {
    return {
        ok: true,
        notes: readerDb.listNotes(userId, { bookId: payload.bookId ?? null, q: payload.q ?? null })
    };
}
function deleteNote(authDb, readerDb, userId, payload) {
    const noteId = payload.noteId?.trim();
    if (!noteId) {
        return { ok: false, error: 'Note not found' };
    }
    const deleted = readerDb.deleteNote(userId, noteId);
    if (!deleted) {
        return { ok: false, error: 'Note not found' };
    }
    return { ok: true };
}
function updateNote(authDb, readerDb, userId, payload) {
    const noteId = payload.noteId?.trim();
    if (!noteId) {
        return { ok: false, error: 'Note not found' };
    }
    const content = payload.content?.trim();
    if (!content) {
        return { ok: false, error: 'Note content is required.' };
    }
    const updated = readerDb.updateNote(userId, noteId, content);
    if (!updated) {
        return { ok: false, error: 'Note not found' };
    }
    return { ok: true, note: updated };
}
