"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listWishlistItems = listWishlistItems;
exports.saveWishlistItem = saveWishlistItem;
exports.removeWishlistItem = removeWishlistItem;
exports.updateWishlistItem = updateWishlistItem;
const node_crypto_1 = require("node:crypto");
function normalizeLookupValue(value) {
    return (value ?? '').trim().toLocaleLowerCase();
}
function mapWishlistRow(row) {
    return {
        id: row.id,
        title: row.title,
        author: row.author,
        reason: row.reason,
        confidence: typeof row.confidence === 'number' ? row.confidence : null,
        createdAt: row.created_at,
        readLater: row.read_later === 1
    };
}
function listWishlistItems(db, userId) {
    const rows = db
        .prepare(`SELECT id, title, author, reason, confidence, created_at, read_later
       FROM wishlist_items
       WHERE user_id = ?
       ORDER BY read_later DESC, created_at DESC`)
        .all(userId);
    return {
        ok: true,
        items: rows.map(mapWishlistRow)
    };
}
function saveWishlistItem(db, userId, payload) {
    const title = payload.title?.trim();
    const reason = payload.reason?.trim();
    const author = payload.author?.trim() || null;
    const confidence = typeof payload.confidence === 'number' && Number.isFinite(payload.confidence) ? payload.confidence : null;
    if (!title) {
        return { ok: false, error: 'Title is required.' };
    }
    if (!reason) {
        return { ok: false, error: 'Reason is required.' };
    }
    const existingRow = db
        .prepare(`SELECT id, title, author, reason, confidence, created_at, read_later
       FROM wishlist_items
       WHERE user_id = ?
         AND lower(trim(title)) = ?
         AND lower(trim(COALESCE(author, ''))) = ?
       LIMIT 1`)
        .get(userId, normalizeLookupValue(title), normalizeLookupValue(author));
    if (existingRow) {
        return {
            ok: true,
            item: mapWishlistRow(existingRow),
            alreadySaved: true
        };
    }
    const now = Date.now();
    const item = {
        id: (0, node_crypto_1.randomUUID)(),
        title,
        author,
        reason,
        confidence,
        createdAt: now,
        readLater: false
    };
    db.prepare(`INSERT INTO wishlist_items (id, user_id, title, author, reason, confidence, created_at, read_later)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(item.id, userId, item.title, item.author, item.reason, item.confidence, item.createdAt, 0);
    return {
        ok: true,
        item,
        alreadySaved: false
    };
}
function removeWishlistItem(db, userId, payload) {
    const itemId = payload.itemId?.trim();
    if (!itemId) {
        return { ok: false, error: 'Wishlist item not found.' };
    }
    const result = db.prepare('DELETE FROM wishlist_items WHERE id = ? AND user_id = ?').run(itemId, userId);
    if (result.changes === 0) {
        return { ok: false, error: 'Wishlist item not found.' };
    }
    return { ok: true };
}
function updateWishlistItem(db, userId, payload) {
    const itemId = payload.itemId?.trim();
    if (!itemId) {
        return { ok: false, error: 'Wishlist item not found.' };
    }
    db.prepare(`UPDATE wishlist_items
     SET read_later = ?
     WHERE id = ? AND user_id = ?`).run(payload.readLater ? 1 : 0, itemId, userId);
    const row = db
        .prepare(`SELECT id, title, author, reason, confidence, created_at, read_later
       FROM wishlist_items
       WHERE id = ? AND user_id = ?
       LIMIT 1`)
        .get(itemId, userId);
    if (!row) {
        return { ok: false, error: 'Wishlist item not found.' };
    }
    return {
        ok: true,
        item: mapWishlistRow(row)
    };
}
