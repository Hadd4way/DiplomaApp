import type Database from 'better-sqlite3';
import type {
  EpubProgressGetRequest,
  EpubProgressGetResult,
  EpubProgressSetRequest,
  EpubProgressSetResult
} from '../shared/ipc';
import { resolveSessionUserId } from './auth';
import type { ReaderProgressDb } from './reader-progress-db';

function resolveOwnedEpubBookId(authDb: Database.Database, userId: string, rawBookId: string): string | null {
  const bookId = rawBookId?.trim();
  if (!bookId) {
    return null;
  }
  const row = authDb
    .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? AND format = ? LIMIT 1')
    .get(bookId, userId, 'epub') as { id: string } | undefined;
  return row ? bookId : null;
}

export function getEpubProgress(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  payload: EpubProgressGetRequest
): EpubProgressGetResult {
  const session = resolveSessionUserId(authDb, payload.token);
  if (!session.ok) {
    return session;
  }
  const bookId = resolveOwnedEpubBookId(authDb, session.userId, payload.bookId);
  if (!bookId) {
    return { ok: false, error: 'Book not found' };
  }
  return { ok: true, cfi: readerDb.getLastEpubCfi(session.userId, bookId) };
}

export function setEpubProgress(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  payload: EpubProgressSetRequest
): EpubProgressSetResult {
  const session = resolveSessionUserId(authDb, payload.token);
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
