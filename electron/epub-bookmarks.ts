import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  EpubBookmarksListRequest,
  EpubBookmarksListResult,
  EpubBookmarksToggleRequest,
  EpubBookmarksToggleResult
} from '../shared/ipc';
import type { ReaderProgressDb } from './reader-progress-db';

function asNonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasOwnedBook(authDb: Database.Database, userId: string, bookId: string): boolean {
  const ownedBook = authDb
    .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? LIMIT 1')
    .get(bookId, userId) as { id: string } | undefined;
  return Boolean(ownedBook);
}

export function listEpubBookmarks(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  userId: string,
  payload: EpubBookmarksListRequest
): EpubBookmarksListResult {
  const bookId = asNonEmptyString(payload.bookId);
  if (!bookId || !hasOwnedBook(authDb, userId, bookId)) {
    return { ok: false, error: 'Book not found' };
  }

  return { ok: true, bookmarks: readerDb.listEpubBookmarks(userId, bookId) };
}

export function toggleEpubBookmark(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  userId: string,
  payload: EpubBookmarksToggleRequest
): EpubBookmarksToggleResult {
  const bookId = asNonEmptyString(payload.bookId);
  if (!bookId || !hasOwnedBook(authDb, userId, bookId)) {
    return { ok: false, error: 'Book not found' };
  }

  const cfi = asNonEmptyString(payload.cfi);
  if (!cfi) {
    return { ok: false, error: 'Invalid EPUB location' };
  }

  const result = readerDb.toggleEpubBookmark(userId, bookId, cfi, payload.label ?? null, () => randomUUID());
  if (!result) {
    return { ok: false, error: 'Failed to toggle bookmark.' };
  }

  return { ok: true, bookmarked: result.bookmarked, bookmark: result.bookmark ?? undefined };
}
