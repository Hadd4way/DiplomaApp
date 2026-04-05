"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEpubBookmarks = listEpubBookmarks;
exports.toggleEpubBookmark = toggleEpubBookmark;
const node_crypto_1 = require("node:crypto");
function asNonEmptyString(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function hasOwnedBook(authDb, userId, bookId) {
    const ownedBook = authDb
        .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, userId);
    return Boolean(ownedBook);
}
function listEpubBookmarks(authDb, readerDb, userId, payload) {
    const bookId = asNonEmptyString(payload.bookId);
    if (!bookId || !hasOwnedBook(authDb, userId, bookId)) {
        return { ok: false, error: 'Book not found' };
    }
    return { ok: true, bookmarks: readerDb.listEpubBookmarks(userId, bookId) };
}
function toggleEpubBookmark(authDb, readerDb, userId, payload) {
    const bookId = asNonEmptyString(payload.bookId);
    if (!bookId || !hasOwnedBook(authDb, userId, bookId)) {
        return { ok: false, error: 'Book not found' };
    }
    const cfi = asNonEmptyString(payload.cfi);
    if (!cfi) {
        return { ok: false, error: 'Invalid EPUB location' };
    }
    const result = readerDb.toggleEpubBookmark(userId, bookId, cfi, payload.label ?? null, () => (0, node_crypto_1.randomUUID)());
    if (!result) {
        return { ok: false, error: 'Failed to toggle bookmark.' };
    }
    return { ok: true, bookmarked: result.bookmarked, bookmark: result.bookmark ?? undefined };
}
