"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBookmarks = listBookmarks;
exports.toggleBookmark = toggleBookmark;
exports.removeBookmark = removeBookmark;
const node_crypto_1 = require("node:crypto");
const auth_1 = require("./auth");
function normalizePage(page) {
    if (!Number.isFinite(page)) {
        return null;
    }
    const safePage = Math.floor(page);
    return safePage >= 1 ? safePage : null;
}
function hasOwnedBook(authDb, userId, bookId) {
    const ownedBook = authDb
        .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, userId);
    return Boolean(ownedBook);
}
function listBookmarks(authDb, readerDb, payload) {
    const session = (0, auth_1.resolveSessionUserId)(authDb, payload.token);
    if (!session.ok) {
        return session;
    }
    const bookId = payload.bookId?.trim();
    if (!bookId || !hasOwnedBook(authDb, session.userId, bookId)) {
        return { ok: false, error: 'Book not found' };
    }
    return { ok: true, bookmarks: readerDb.listBookmarks(session.userId, bookId) };
}
function toggleBookmark(authDb, readerDb, payload) {
    const session = (0, auth_1.resolveSessionUserId)(authDb, payload.token);
    if (!session.ok) {
        return session;
    }
    const bookId = payload.bookId?.trim();
    if (!bookId || !hasOwnedBook(authDb, session.userId, bookId)) {
        return { ok: false, error: 'Book not found' };
    }
    const page = normalizePage(payload.page);
    if (!page) {
        return { ok: false, error: 'Invalid page' };
    }
    const bookmarked = readerDb.toggleBookmark(session.userId, bookId, page, () => (0, node_crypto_1.randomUUID)());
    if (bookmarked === null) {
        return { ok: false, error: 'Failed to toggle bookmark.' };
    }
    return { ok: true, bookmarked };
}
function removeBookmark(authDb, readerDb, payload) {
    const session = (0, auth_1.resolveSessionUserId)(authDb, payload.token);
    if (!session.ok) {
        return session;
    }
    const bookId = payload.bookId?.trim();
    if (!bookId || !hasOwnedBook(authDb, session.userId, bookId)) {
        return { ok: false, error: 'Book not found' };
    }
    const page = normalizePage(payload.page);
    if (!page) {
        return { ok: false, error: 'Invalid page' };
    }
    readerDb.removeBookmark(session.userId, bookId, page);
    return { ok: true };
}
