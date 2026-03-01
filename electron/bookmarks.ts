import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  BookmarksListRequest,
  BookmarksListResult,
  BookmarksRemoveRequest,
  BookmarksRemoveResult,
  BookmarksToggleRequest,
  BookmarksToggleResult
} from '../shared/ipc';
import { resolveSessionUserId } from './auth';
import type { ReaderProgressDb } from './reader-progress-db';

function normalizePage(page: number): number | null {
  if (!Number.isFinite(page)) {
    return null;
  }
  const safePage = Math.floor(page);
  return safePage >= 1 ? safePage : null;
}

function hasOwnedBook(authDb: Database.Database, userId: string, bookId: string): boolean {
  const ownedBook = authDb
    .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? LIMIT 1')
    .get(bookId, userId) as { id: string } | undefined;
  return Boolean(ownedBook);
}

export function listBookmarks(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  payload: BookmarksListRequest
): BookmarksListResult {
  const session = resolveSessionUserId(authDb, payload.token);
  if (!session.ok) {
    return session;
  }

  const bookId = payload.bookId?.trim();
  if (!bookId || !hasOwnedBook(authDb, session.userId, bookId)) {
    return { ok: false, error: 'Book not found' };
  }

  return { ok: true, bookmarks: readerDb.listBookmarks(session.userId, bookId) };
}

export function toggleBookmark(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  payload: BookmarksToggleRequest
): BookmarksToggleResult {
  const session = resolveSessionUserId(authDb, payload.token);
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

  const bookmarked = readerDb.toggleBookmark(session.userId, bookId, page, () => randomUUID());
  if (bookmarked === null) {
    return { ok: false, error: 'Failed to toggle bookmark.' };
  }

  return { ok: true, bookmarked };
}

export function removeBookmark(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  payload: BookmarksRemoveRequest
): BookmarksRemoveResult {
  const session = resolveSessionUserId(authDb, payload.token);
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
