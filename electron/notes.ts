import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  Note,
  NotesCreateRequest,
  NotesCreateResult,
  NotesDeleteRequest,
  NotesDeleteResult,
  NotesListRequest,
  NotesListResult
} from '../shared/ipc';
import { resolveSessionUserId } from './auth';
import type { ReaderProgressDb } from './reader-progress-db';

function isValidPage(page: number): boolean {
  return Number.isFinite(page) && Math.floor(page) >= 1;
}

export function createNote(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  payload: NotesCreateRequest
): NotesCreateResult {
  const session = resolveSessionUserId(authDb, payload.token);
  if (!session.ok) {
    return session;
  }

  const bookId = payload.bookId?.trim();
  if (!bookId) {
    return { ok: false, error: 'Book not found' };
  }

  if (!isValidPage(payload.page)) {
    return { ok: false, error: 'Invalid page' };
  }

  const content = payload.content?.trim();
  if (!content) {
    return { ok: false, error: 'Note content is required.' };
  }

  const ownedBook = authDb
    .prepare('SELECT id FROM books WHERE id = ? AND user_id = ? LIMIT 1')
    .get(bookId, session.userId) as { id: string } | undefined;

  if (!ownedBook) {
    return { ok: false, error: 'Book not found' };
  }

  const now = Date.now();
  const note: Note = {
    id: randomUUID(),
    userId: session.userId,
    bookId,
    page: Math.floor(payload.page),
    content,
    createdAt: now,
    updatedAt: now
  };

  const created = readerDb.createNote(note);
  if (!created) {
    return { ok: false, error: 'Failed to create note.' };
  }

  return { ok: true, note: created };
}

export function listNotes(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  payload: NotesListRequest
): NotesListResult {
  const session = resolveSessionUserId(authDb, payload.token);
  if (!session.ok) {
    return session;
  }

  return { ok: true, notes: readerDb.listNotes(session.userId) };
}

export function deleteNote(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  payload: NotesDeleteRequest
): NotesDeleteResult {
  const session = resolveSessionUserId(authDb, payload.token);
  if (!session.ok) {
    return session;
  }

  const noteId = payload.noteId?.trim();
  if (!noteId) {
    return { ok: false, error: 'Note not found' };
  }

  const deleted = readerDb.deleteNote(session.userId, noteId);
  if (!deleted) {
    return { ok: false, error: 'Note not found' };
  }

  return { ok: true };
}
