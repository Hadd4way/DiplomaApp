"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFlowProgress = getFlowProgress;
exports.setFlowProgress = setFlowProgress;
function resolveOwnedFlowBookId(authDb, userId, rawBookId) {
    const bookId = rawBookId?.trim();
    if (!bookId) {
        return null;
    }
    const row = authDb
        .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? AND format = ? LIMIT 1')
        .get(bookId, userId, 'fb2');
    if (row) {
        return bookId;
    }
    const txtRow = authDb
        .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? AND format = ? LIMIT 1')
        .get(bookId, userId, 'txt');
    return txtRow ? bookId : null;
}
function getFlowProgress(authDb, readerDb, userId, payload) {
    const bookId = resolveOwnedFlowBookId(authDb, userId, payload.bookId);
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    return {
        ok: true,
        progress: readerDb.getFlowProgress(userId, bookId)
    };
}
function setFlowProgress(authDb, readerDb, userId, payload) {
    const bookId = resolveOwnedFlowBookId(authDb, userId, payload.bookId);
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    if (!Number.isFinite(payload.chapterIndex) || payload.chapterIndex < 0) {
        return { ok: false, error: 'Invalid chapter index' };
    }
    if (!Number.isFinite(payload.scrollRatio) || payload.scrollRatio < 0 || payload.scrollRatio > 1) {
        return { ok: false, error: 'Invalid scroll position' };
    }
    readerDb.setFlowProgress(userId, bookId, payload.chapterIndex, payload.scrollRatio);
    return { ok: true };
}
