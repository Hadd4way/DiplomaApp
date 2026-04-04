"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBookmarks = listBookmarks;
exports.toggleBookmark = toggleBookmark;
exports.removeBookmark = removeBookmark;
const node_crypto_1 = require("node:crypto");
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
function listBookmarks(authDb, readerDb, userId, payload) {
    const bookId = payload.bookId?.trim();
    if (!bookId || !hasOwnedBook(authDb, userId, bookId)) {
        return { ok: false, error: 'Book not found' };
    }
    return { ok: true, bookmarks: readerDb.listBookmarks(userId, bookId) };
}
function toggleBookmark(authDb, readerDb, userId, payload) {
    const bookId = payload.bookId?.trim();
    if (!bookId || !hasOwnedBook(authDb, userId, bookId)) {
        return { ok: false, error: 'Book not found' };
    }
    const page = normalizePage(payload.page);
    if (!page) {
        return { ok: false, error: 'Invalid page' };
    }
    const bookmarked = readerDb.toggleBookmark(userId, bookId, page, () => (0, node_crypto_1.randomUUID)());
    if (bookmarked === null) {
        return { ok: false, error: 'Failed to toggle bookmark.' };
    }
    return { ok: true, bookmarked };
}
function removeBookmark(authDb, readerDb, userId, payload) {
    const bookId = payload.bookId?.trim();
    if (!bookId || !hasOwnedBook(authDb, userId, bookId)) {
        return { ok: false, error: 'Book not found' };
    }
    const page = normalizePage(payload.page);
    if (!page) {
        return { ok: false, error: 'Invalid page' };
    }
    readerDb.removeBookmark(userId, bookId, page);
    return { ok: true };
}
