import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Note } from '../shared/ipc';

type GetRow = { last_page: number };
type NoteRow = {
  id: string;
  user_id: string;
  book_id: string;
  page: number;
  content: string;
  created_at: number;
  updated_at: number;
};

function asNonEmptyString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeLastPage(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  const page = Math.floor(value);
  return page >= 1 ? page : null;
}

function normalizeNoteContent(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    page: row.page,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class ReaderProgressDb {
  private db: Database.Database;

  private getStmt: Database.Statement<[string, string], GetRow | undefined>;

  private upsertStmt: Database.Statement<[string, string, number, number]>;
  private insertNoteStmt: Database.Statement<[string, string, string, number, string, number, number]>;
  private listNotesStmt: Database.Statement<[string], NoteRow>;
  private deleteNoteStmt: Database.Statement<[string, string]>;

  constructor(userDataPath: string) {
    fs.mkdirSync(userDataPath, { recursive: true });
    const dbPath = path.join(userDataPath, 'reader.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reading_progress (
        user_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        last_page INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, book_id)
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        page INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notes_user_created_at ON notes(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notes_user_book_page ON notes(user_id, book_id, page);
    `);

    this.getStmt = this.db.prepare(
      'SELECT last_page FROM reading_progress WHERE user_id = ? AND book_id = ? LIMIT 1'
    );
    this.upsertStmt = this.db.prepare(`
      INSERT INTO reading_progress (user_id, book_id, last_page, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, book_id) DO UPDATE SET
        last_page = excluded.last_page,
        updated_at = excluded.updated_at
    `);
    this.insertNoteStmt = this.db.prepare(
      `INSERT INTO notes (id, user_id, book_id, page, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    this.listNotesStmt = this.db.prepare(
      `SELECT id, user_id, book_id, page, content, created_at, updated_at
       FROM notes
       WHERE user_id = ?
       ORDER BY created_at DESC`
    );
    this.deleteNoteStmt = this.db.prepare('DELETE FROM notes WHERE user_id = ? AND id = ?');
  }

  getLastPage(userId: string, bookId: string): number | null {
    const safeUserId = asNonEmptyString(userId);
    const safeBookId = asNonEmptyString(bookId);
    if (!safeUserId || !safeBookId) {
      return null;
    }

    const row = this.getStmt.get(safeUserId, safeBookId);
    if (!row) {
      return null;
    }

    return normalizeLastPage(row.last_page);
  }

  setLastPage(userId: string, bookId: string, lastPage: number): void {
    const safeUserId = asNonEmptyString(userId);
    const safeBookId = asNonEmptyString(bookId);
    const safeLastPage = normalizeLastPage(lastPage);
    if (!safeUserId || !safeBookId || !safeLastPage) {
      return;
    }

    this.upsertStmt.run(safeUserId, safeBookId, safeLastPage, Date.now());
  }

  createNote(note: Note): Note | null {
    const safeUserId = asNonEmptyString(note.userId);
    const safeBookId = asNonEmptyString(note.bookId);
    const safePage = normalizeLastPage(note.page);
    const safeContent = normalizeNoteContent(note.content);
    const safeId = asNonEmptyString(note.id);
    if (!safeUserId || !safeBookId || !safePage || !safeContent || !safeId) {
      return null;
    }

    const now = Number.isFinite(note.updatedAt) ? Math.floor(note.updatedAt) : Date.now();
    const createdAt = Number.isFinite(note.createdAt) ? Math.floor(note.createdAt) : now;
    this.insertNoteStmt.run(safeId, safeUserId, safeBookId, safePage, safeContent, createdAt, now);
    return {
      id: safeId,
      userId: safeUserId,
      bookId: safeBookId,
      page: safePage,
      content: safeContent,
      createdAt,
      updatedAt: now
    };
  }

  listNotes(userId: string): Note[] {
    const safeUserId = asNonEmptyString(userId);
    if (!safeUserId) {
      return [];
    }

    const rows = this.listNotesStmt.all(safeUserId);
    return rows.map(toNote);
  }

  deleteNote(userId: string, noteId: string): boolean {
    const safeUserId = asNonEmptyString(userId);
    const safeNoteId = asNonEmptyString(noteId);
    if (!safeUserId || !safeNoteId) {
      return false;
    }

    const result = this.deleteNoteStmt.run(safeUserId, safeNoteId);
    return result.changes > 0;
  }
}

let instance: ReaderProgressDb | null = null;

export function getReaderProgressDb(userDataPath: string): ReaderProgressDb {
  if (instance) {
    return instance;
  }

  instance = new ReaderProgressDb(userDataPath);
  return instance;
}
