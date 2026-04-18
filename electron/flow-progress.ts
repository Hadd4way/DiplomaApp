import type Database from 'better-sqlite3';
import type {
  FlowProgressGetRequest,
  FlowProgressGetResult,
  FlowProgressSetRequest,
  FlowProgressSetResult
} from '../shared/ipc';
import type { ReaderProgressDb } from './reader-progress-db';

function resolveOwnedFlowBookId(authDb: Database.Database, userId: string, rawBookId: string): string | null {
  const bookId = rawBookId?.trim();
  if (!bookId) {
    return null;
  }
  const row = authDb
    .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? AND format = ? LIMIT 1')
    .get(bookId, userId, 'fb2') as { id: string } | undefined;
  return row ? bookId : null;
}

export function getFlowProgress(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  userId: string,
  payload: FlowProgressGetRequest
): FlowProgressGetResult {
  const bookId = resolveOwnedFlowBookId(authDb, userId, payload.bookId);
  if (!bookId) {
    return { ok: false, error: 'Book not found' };
  }

  return {
    ok: true,
    progress: readerDb.getFlowProgress(userId, bookId)
  };
}

export function setFlowProgress(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  userId: string,
  payload: FlowProgressSetRequest
): FlowProgressSetResult {
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
