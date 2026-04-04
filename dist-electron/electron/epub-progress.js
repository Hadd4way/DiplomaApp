"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEpubProgress = getEpubProgress;
exports.setEpubProgress = setEpubProgress;
function resolveOwnedEpubBookId(authDb, userId, rawBookId) {
    const bookId = rawBookId?.trim();
    if (!bookId) {
        return null;
    }
    const row = authDb
        .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? AND format = ? LIMIT 1')
        .get(bookId, userId, 'epub');
    return row ? bookId : null;
}
function getEpubProgress(authDb, readerDb, userId, payload) {
    const bookId = resolveOwnedEpubBookId(authDb, userId, payload.bookId);
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    return { ok: true, cfi: readerDb.getLastEpubCfi(userId, bookId) };
}
function setEpubProgress(authDb, readerDb, userId, payload) {
    const bookId = resolveOwnedEpubBookId(authDb, userId, payload.bookId);
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const cfi = payload.cfi?.trim();
    if (!cfi) {
        return { ok: false, error: 'Invalid CFI' };
    }
    readerDb.setLastEpubCfi(userId, bookId, cfi);
    return { ok: true };
}
