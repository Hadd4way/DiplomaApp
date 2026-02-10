"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNote = createNote;
exports.listNotes = listNotes;
exports.deleteNote = deleteNote;
exports.updateNote = updateNote;
const node_crypto_1 = require("node:crypto");
const auth_1 = require("./auth");
function isValidPage(page) {
    return Number.isFinite(page) && Math.floor(page) >= 1;
}
function createNote(authDb, readerDb, payload) {
    const session = (0, auth_1.resolveSessionUserId)(authDb, payload.token);
    if (!session.ok) {
        return session;
    }
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
        .get(bookId, session.userId);
    if (!ownedBook) {
        return { ok: false, error: 'Book not found' };
    }
    const now = Date.now();
    const note = {
        id: (0, node_crypto_1.randomUUID)(),
        userId: session.userId,
        bookId,
        page: Math.floor(payload.page),
        content,
        createdAt: now,
        updatedAt: now
    };
    const created = readerDb.createNote(note);
    if (!created) {
        return { ok: false, error: 'Failed to create note.' };
    }
    return { ok: true, note: created };
}
function listNotes(authDb, readerDb, payload) {
    const session = (0, auth_1.resolveSessionUserId)(authDb, payload.token);
    if (!session.ok) {
        return session;
    }
    return {
        ok: true,
        notes: readerDb.listNotes(session.userId, { bookId: payload.bookId ?? null, q: payload.q ?? null })
    };
}
function deleteNote(authDb, readerDb, payload) {
    const session = (0, auth_1.resolveSessionUserId)(authDb, payload.token);
    if (!session.ok) {
        return session;
    }
    const noteId = payload.noteId?.trim();
    if (!noteId) {
        return { ok: false, error: 'Note not found' };
    }
    const deleted = readerDb.deleteNote(session.userId, noteId);
    if (!deleted) {
        return { ok: false, error: 'Note not found' };
    }
    return { ok: true };
}
function updateNote(authDb, readerDb, payload) {
    const session = (0, auth_1.resolveSessionUserId)(authDb, payload.token);
    if (!session.ok) {
        return session;
    }
    const noteId = payload.noteId?.trim();
    if (!noteId) {
        return { ok: false, error: 'Note not found' };
    }
    const content = payload.content?.trim();
    if (!content) {
        return { ok: false, error: 'Note content is required.' };
    }
    const updated = readerDb.updateNote(session.userId, noteId, content);
    if (!updated) {
        return { ok: false, error: 'Note not found' };
    }
    return { ok: true, note: updated };
}
