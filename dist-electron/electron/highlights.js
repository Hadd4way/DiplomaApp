"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listHighlights = listHighlights;
exports.createMergedHighlight = createMergedHighlight;
exports.deleteHighlight = deleteHighlight;
exports.insertRawHighlight = insertRawHighlight;
const node_crypto_1 = require("node:crypto");
const auth_1 = require("./auth");
const EPSILON = 0.002;
const LINE_EPSILON = 0.01;
const GAP_EPSILON = 0.005;
const MIN_RECT_SIZE = 0.000001;
function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}
function normalizeRect(rect) {
    const rawX = Number(rect.x);
    const rawY = Number(rect.y);
    const rawW = Number(rect.w);
    const rawH = Number(rect.h);
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY) || !Number.isFinite(rawW) || !Number.isFinite(rawH)) {
        return null;
    }
    const x1 = clamp01(rawX);
    const y1 = clamp01(rawY);
    const x2 = clamp01(rawX + rawW);
    const y2 = clamp01(rawY + rawH);
    const w = x2 - x1;
    const h = y2 - y1;
    if (w <= MIN_RECT_SIZE || h <= MIN_RECT_SIZE) {
        return null;
    }
    return { x: x1, y: y1, w, h };
}
function normalizePage(page) {
    if (!Number.isFinite(page)) {
        return null;
    }
    const nextPage = Math.floor(page);
    return nextPage >= 1 ? nextPage : null;
}
function rectsOverlap(a, b, epsilon) {
    const overlapX = a.x < b.x + b.w - epsilon && a.x + a.w > b.x + epsilon;
    const overlapY = a.y < b.y + b.h - epsilon && a.y + a.h > b.y + epsilon;
    return overlapX && overlapY;
}
function rectsCloseOnSameLine(a, b, epsilon) {
    const topA = a.y;
    const bottomA = a.y + a.h;
    const topB = b.y;
    const bottomB = b.y + b.h;
    const verticalOverlap = Math.min(bottomA, bottomB) - Math.max(topA, topB);
    const sameLine = verticalOverlap >= -epsilon;
    if (!sameLine) {
        return false;
    }
    const leftA = a.x;
    const rightA = a.x + a.w;
    const leftB = b.x;
    const rightB = b.x + b.w;
    const horizontalGap = Math.max(leftA, leftB) - Math.min(rightA, rightB);
    return horizontalGap <= epsilon;
}
function mergePair(a, b) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const r = Math.max(a.x + a.w, b.x + b.w);
    const bottom = Math.max(a.y + a.h, b.y + b.h);
    return {
        x,
        y,
        w: r - x,
        h: bottom - y
    };
}
function mergeRectsByLine(rects) {
    const normalized = rects
        .map((rect) => normalizeRect(rect))
        .filter((rect) => Boolean(rect))
        .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
    if (normalized.length <= 1) {
        return normalized;
    }
    const lineGroups = [];
    for (const rect of normalized) {
        const centerY = rect.y + rect.h / 2;
        let assigned = false;
        for (const group of lineGroups) {
            const groupCenterY = group.reduce((sum, item) => sum + (item.y + item.h / 2), 0) / group.length;
            if (Math.abs(centerY - groupCenterY) < LINE_EPSILON) {
                group.push(rect);
                assigned = true;
                break;
            }
        }
        if (!assigned) {
            lineGroups.push([rect]);
        }
    }
    const merged = [];
    for (const group of lineGroups) {
        const sorted = group.sort((a, b) => a.x - b.x);
        let current = sorted[0];
        for (let i = 1; i < sorted.length; i += 1) {
            const next = sorted[i];
            const touchesOrOverlapsX = current.x + current.w >= next.x - GAP_EPSILON;
            if (touchesOrOverlapsX) {
                current = mergePair(current, next);
            }
            else {
                merged.push(current);
                current = next;
            }
        }
        merged.push(current);
    }
    return merged.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
}
function anyOverlap(left, right) {
    for (const a of left) {
        for (const b of right) {
            if (rectsOverlap(a, b, EPSILON)) {
                return true;
            }
        }
    }
    return false;
}
function listHighlights(authDb, readerDb, payload) {
    const session = (0, auth_1.resolveSessionUserId)(authDb, payload.token);
    if (!session.ok) {
        return session;
    }
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const page = normalizePage(payload.page);
    if (!page) {
        return { ok: false, error: 'Invalid page' };
    }
    return { ok: true, highlights: readerDb.listHighlights(session.userId, bookId, page) };
}
function createMergedHighlight(authDb, readerDb, payload) {
    const session = (0, auth_1.resolveSessionUserId)(authDb, payload.token);
    if (!session.ok) {
        return session;
    }
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const page = normalizePage(payload.page);
    if (!page) {
        return { ok: false, error: 'Invalid page' };
    }
    const incoming = mergeRectsByLine(payload.rects ?? []);
    if (incoming.length === 0) {
        return { ok: false, error: 'At least one highlight rect is required.' };
    }
    const ownedBook = authDb
        .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, session.userId);
    if (!ownedBook) {
        return { ok: false, error: 'Book not found' };
    }
    const existing = readerDb.listHighlights(session.userId, bookId, page);
    const overlapIds = [];
    const allRectsToMerge = [...incoming];
    for (const highlight of existing) {
        if (anyOverlap(incoming, highlight.rects)) {
            overlapIds.push(highlight.id);
            allRectsToMerge.push(...highlight.rects);
        }
    }
    const finalRects = mergeRectsByLine(allRectsToMerge);
    if (finalRects.length === 0) {
        return { ok: false, error: 'At least one highlight rect is required.' };
    }
    const now = Date.now();
    const created = readerDb.createMergedHighlight(session.userId, bookId, page, finalRects, (0, node_crypto_1.randomUUID)(), now, now, overlapIds);
    if (!created) {
        return { ok: false, error: 'Failed to create highlight.' };
    }
    return { ok: true, highlight: created };
}
function deleteHighlight(authDb, readerDb, payload) {
    const session = (0, auth_1.resolveSessionUserId)(authDb, payload.token);
    if (!session.ok) {
        return session;
    }
    const highlightId = payload.highlightId?.trim();
    if (!highlightId) {
        return { ok: false, error: 'Highlight not found' };
    }
    const deleted = readerDb.deleteHighlight(session.userId, highlightId);
    if (!deleted) {
        return { ok: false, error: 'Highlight not found' };
    }
    return { ok: true };
}
function insertRawHighlight(authDb, readerDb, payload) {
    const session = (0, auth_1.resolveSessionUserId)(authDb, payload.token);
    if (!session.ok) {
        return session;
    }
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const page = normalizePage(payload.page);
    if (!page) {
        return { ok: false, error: 'Invalid page' };
    }
    const rects = (payload.rects ?? [])
        .map((rect) => normalizeRect(rect))
        .filter((rect) => Boolean(rect));
    if (rects.length === 0) {
        return { ok: false, error: 'At least one highlight rect is required.' };
    }
    const ownedBook = authDb
        .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? LIMIT 1')
        .get(bookId, session.userId);
    if (!ownedBook) {
        return { ok: false, error: 'Book not found' };
    }
    const now = Date.now();
    const created = readerDb.insertHighlight(session.userId, bookId, page, rects, (0, node_crypto_1.randomUUID)(), now, now);
    if (!created) {
        return { ok: false, error: 'Failed to create highlight.' };
    }
    return { ok: true, highlight: created };
}
