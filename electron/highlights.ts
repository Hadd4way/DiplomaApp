import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  Highlight,
  HighlightRect,
  HighlightsCreateMergedRequest,
  HighlightsCreateMergedResult,
  HighlightsDeleteRequest,
  HighlightsDeleteResult,
  HighlightsInsertRawRequest,
  HighlightsInsertRawResult,
  HighlightsListRequest,
  HighlightsListResult,
  HighlightsUpdateNoteRequest,
  HighlightsUpdateNoteResult
} from '../shared/ipc';
import type { ReaderProgressDb } from './reader-progress-db';

const EPSILON = 0.002;
const LINE_EPSILON = 0.01;
const GAP_EPSILON = 0.005;
const MIN_RECT_SIZE = 0.000001;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeRect(rect: HighlightRect): HighlightRect | null {
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

function normalizePage(page: number): number | null {
  if (!Number.isFinite(page)) {
    return null;
  }
  const nextPage = Math.floor(page);
  return nextPage >= 1 ? nextPage : null;
}

function normalizeHighlightText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function mergeHighlightTexts(values: Array<string | null | undefined>): string | null {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const value of values) {
    const normalized = normalizeHighlightText(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    merged.push(normalized);
  }
  if (merged.length === 0) {
    return null;
  }
  return merged.join('\n');
}

function rectsOverlap(a: HighlightRect, b: HighlightRect, epsilon: number): boolean {
  const overlapX = a.x < b.x + b.w - epsilon && a.x + a.w > b.x + epsilon;
  const overlapY = a.y < b.y + b.h - epsilon && a.y + a.h > b.y + epsilon;
  return overlapX && overlapY;
}

function rectsCloseOnSameLine(a: HighlightRect, b: HighlightRect, epsilon: number): boolean {
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

function mergePair(a: HighlightRect, b: HighlightRect): HighlightRect {
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

function mergeRectsByLine(rects: HighlightRect[]): HighlightRect[] {
  const normalized = rects
    .map((rect) => normalizeRect(rect))
    .filter((rect): rect is HighlightRect => Boolean(rect))
    .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

  if (normalized.length <= 1) {
    return normalized;
  }

  const lineGroups: HighlightRect[][] = [];
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

  const merged: HighlightRect[] = [];
  for (const group of lineGroups) {
    const sorted = group.sort((a, b) => a.x - b.x);
    let current = sorted[0];
    for (let i = 1; i < sorted.length; i += 1) {
      const next = sorted[i];
      const touchesOrOverlapsX = current.x + current.w >= next.x - GAP_EPSILON;
      if (touchesOrOverlapsX) {
        current = mergePair(current, next);
      } else {
        merged.push(current);
        current = next;
      }
    }
    merged.push(current);
  }

  return merged.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
}

function anyOverlap(left: HighlightRect[], right: HighlightRect[]): boolean {
  for (const a of left) {
    for (const b of right) {
      if (rectsOverlap(a, b, EPSILON)) {
        return true;
      }
    }
  }
  return false;
}

export function listHighlights(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  userId: string,
  payload: HighlightsListRequest
): HighlightsListResult {
  const bookId = payload.bookId?.trim();
  if (!bookId) {
    return { ok: false, error: 'Book not found' };
  }
  const page = normalizePage(payload.page);
  if (!page) {
    return { ok: false, error: 'Invalid page' };
  }
  return { ok: true, highlights: readerDb.listHighlights(userId, bookId, page) };
}

function normalizeHighlightNote(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function mergeHighlightNotes(values: Array<string | null | undefined>): string | null {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const value of values) {
    const normalized = normalizeHighlightNote(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    merged.push(normalized);
  }
  if (merged.length === 0) {
    return null;
  }
  return merged.join('\n\n');
}

export function createMergedHighlight(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  userId: string,
  payload: HighlightsCreateMergedRequest
): HighlightsCreateMergedResult {
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
    .get(bookId, userId) as { id: string } | undefined;
  if (!ownedBook) {
    return { ok: false, error: 'Book not found' };
  }

  const existing = readerDb.listHighlights(userId, bookId, page);
  const overlapIds: string[] = [];
  const allRectsToMerge: HighlightRect[] = [...incoming];
  const textParts: Array<string | null | undefined> = [payload.text];
  const noteParts: Array<string | null | undefined> = [];

  for (const highlight of existing) {
    if (anyOverlap(incoming, highlight.rects)) {
      overlapIds.push(highlight.id);
      allRectsToMerge.push(...highlight.rects);
      textParts.push(highlight.text);
      noteParts.push(highlight.note);
    }
  }

  const finalRects = mergeRectsByLine(allRectsToMerge);
  if (finalRects.length === 0) {
    return { ok: false, error: 'At least one highlight rect is required.' };
  }

  const now = Date.now();
  const mergedText = mergeHighlightTexts(textParts);
  const mergedNote = mergeHighlightNotes(noteParts);
  const created = readerDb.createMergedHighlight(
    userId,
    bookId,
    page,
    finalRects,
    mergedText,
    mergedNote,
    randomUUID(),
    now,
    now,
    overlapIds
  );
  if (!created) {
    return { ok: false, error: 'Failed to create highlight.' };
  }
  return { ok: true, highlight: created };
}

export function deleteHighlight(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  userId: string,
  payload: HighlightsDeleteRequest
): HighlightsDeleteResult {
  const highlightId = payload.highlightId?.trim();
  if (!highlightId) {
    return { ok: false, error: 'Highlight not found' };
  }

  const deleted = readerDb.deleteHighlight(userId, highlightId);
  if (!deleted) {
    return { ok: false, error: 'Highlight not found' };
  }

  return { ok: true };
}

export function insertRawHighlight(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  userId: string,
  payload: HighlightsInsertRawRequest
): HighlightsInsertRawResult {
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
    .filter((rect): rect is HighlightRect => Boolean(rect));
  if (rects.length === 0) {
    return { ok: false, error: 'At least one highlight rect is required.' };
  }

  const ownedBook = authDb
    .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? LIMIT 1')
    .get(bookId, userId) as { id: string } | undefined;
  if (!ownedBook) {
    return { ok: false, error: 'Book not found' };
  }

  const now = Date.now();
  const created = readerDb.insertHighlight(
    userId,
    bookId,
    page,
    rects,
    normalizeHighlightText(payload.text),
    normalizeHighlightNote(payload.note),
    randomUUID(),
    now,
    now
  );
  if (!created) {
    return { ok: false, error: 'Failed to create highlight.' };
  }

  return { ok: true, highlight: created as Highlight };
}

export function updateHighlightNote(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  userId: string,
  payload: HighlightsUpdateNoteRequest
): HighlightsUpdateNoteResult {
  const highlightId = payload.highlightId?.trim();
  if (!highlightId) {
    return { ok: false, error: 'Highlight not found' };
  }

  const updated = readerDb.updateHighlightNote(userId, highlightId, normalizeHighlightNote(payload.note));
  if (!updated) {
    return { ok: false, error: 'Highlight not found' };
  }

  return { ok: true, highlight: updated };
}
