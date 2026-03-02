"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEpubProgress = getEpubProgress;
exports.setEpubProgress = setEpubProgress;
const auth_1 = require("./auth");
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
function getEpubProgress(authDb, readerDb, payload) {
    const session = (0, auth_1.resolveSessionUserId)(authDb, payload.token);
    if (!session.ok) {
        return session;
    }
    const bookId = resolveOwnedEpubBookId(authDb, session.userId, payload.bookId);
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    return { ok: true, cfi: readerDb.getLastEpubCfi(session.userId, bookId) };
}
function setEpubProgress(authDb, readerDb, payload) {
    const session = (0, auth_1.resolveSessionUserId)(authDb, payload.token);
    if (!session.ok) {
        return session;
    }
    const bookId = resolveOwnedEpubBookId(authDb, session.userId, payload.bookId);
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const cfi = payload.cfi?.trim();
    if (!cfi) {
        return { ok: false, error: 'Invalid CFI' };
    }
    readerDb.setLastEpubCfi(session.userId, bookId, cfi);
    return { ok: true };
}
