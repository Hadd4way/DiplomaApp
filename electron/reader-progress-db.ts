import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Bookmark, Highlight, HighlightRect, Note } from '../shared/ipc';

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
type HighlightRow = {
  id: string;
  user_id: string;
  book_id: string;
  page: number;
  rects: string;
  created_at: number;
  updated_at: number;
};
type ListNotesFilters = { bookId?: string | null; q?: string | null };
type BookmarkRow = {
  id: string;
  user_id: string;
  book_id: string;
  page: number;
  created_at: number;
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

function toHighlight(row: HighlightRow): Highlight | null {
  let parsedRects: unknown;
  try {
    parsedRects = JSON.parse(row.rects);
  } catch {
    return null;
  }
  if (!Array.isArray(parsedRects)) {
    return null;
  }
  const rects = parsedRects.filter((item): item is HighlightRect => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const rect = item as Partial<HighlightRect>;
    return (
      typeof rect.x === 'number' &&
      Number.isFinite(rect.x) &&
      typeof rect.y === 'number' &&
      Number.isFinite(rect.y) &&
      typeof rect.w === 'number' &&
      Number.isFinite(rect.w) &&
      typeof rect.h === 'number' &&
      Number.isFinite(rect.h)
    );
  });
  if (rects.length === 0) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    page: row.page,
    rects,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    page: row.page,
    createdAt: row.created_at
  };
}

function isBookmarkUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes('UNIQUE constraint failed: bookmarks.user_id, bookmarks.book_id, bookmarks.page');
}

export class ReaderProgressDb {
  private db: Database.Database;

  private getStmt: Database.Statement<[string, string], GetRow | undefined>;

  private upsertStmt: Database.Statement<[string, string, number, number]>;
  private insertNoteStmt: Database.Statement<[string, string, string, number, string, number, number]>;
  private deleteNoteStmt: Database.Statement<[string, string]>;
  private updateNoteStmt: Database.Statement<[string, number, string, string]>;
  private getNoteStmt: Database.Statement<[string, string], NoteRow | undefined>;
  private insertHighlightStmt: Database.Statement<[string, string, string, number, string, number, number]>;
  private deleteHighlightsByIdsStmt: Database.Statement;
  private deleteHighlightStmt: Database.Statement<[string, string]>;
  private listHighlightsStmt: Database.Statement<[string, string, number], HighlightRow>;
  private listBookmarksStmt: Database.Statement<[string, string], BookmarkRow>;
  private insertBookmarkStmt: Database.Statement<[string, string, string, number, number]>;
  private deleteBookmarkByPageStmt: Database.Statement<[string, string, number]>;

  private ensureHighlightsSchema(): void {
    const rows = this.db.prepare('PRAGMA table_info(highlights)').all() as Array<{ name: string }>;
    if (rows.length === 0) {
      return;
    }

    const columns = new Set(rows.map((row) => row.name));

    if (!columns.has('created_at')) {
      this.db.exec('ALTER TABLE highlights ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0');
    }
    if (!columns.has('updated_at')) {
      this.db.exec('ALTER TABLE highlights ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0');
    }

    this.db.exec(`
      UPDATE highlights
      SET updated_at = CASE
        WHEN updated_at IS NULL OR updated_at <= 0 THEN
          CASE
            WHEN created_at IS NULL OR created_at <= 0 THEN CAST(strftime('%s','now') AS INTEGER) * 1000
            ELSE created_at
          END
        ELSE updated_at
      END;

      UPDATE highlights
      SET created_at = CASE
        WHEN created_at IS NULL OR created_at <= 0 THEN updated_at
        ELSE created_at
      END;
    `);
  }

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

      CREATE TABLE IF NOT EXISTS highlights (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        page INTEGER NOT NULL,
        rects TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        page INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(user_id, book_id, page)
      );

      CREATE INDEX IF NOT EXISTS idx_notes_user_created_at ON notes(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notes_user_book_page ON notes(user_id, book_id, page);
      CREATE INDEX IF NOT EXISTS idx_highlights_user_book_page ON highlights(user_id, book_id, page);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_user_book_created_at ON bookmarks(user_id, book_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_user_book_page ON bookmarks(user_id, book_id, page);
    `);
    this.ensureHighlightsSchema();

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
    this.deleteNoteStmt = this.db.prepare('DELETE FROM notes WHERE user_id = ? AND id = ?');
    this.updateNoteStmt = this.db.prepare(
      `UPDATE notes
       SET content = ?, updated_at = ?
       WHERE user_id = ? AND id = ?`
    );
    this.getNoteStmt = this.db.prepare(
      `SELECT id, user_id, book_id, page, content, created_at, updated_at
       FROM notes
       WHERE user_id = ? AND id = ?
       LIMIT 1`
    );
    this.insertHighlightStmt = this.db.prepare(
      `INSERT INTO highlights (id, user_id, book_id, page, rects, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    this.deleteHighlightsByIdsStmt = this.db.prepare(
      `DELETE FROM highlights
       WHERE user_id = @user_id
         AND id IN (SELECT value FROM json_each(@ids_json))`
    );
    this.deleteHighlightStmt = this.db.prepare('DELETE FROM highlights WHERE id = ? AND user_id = ?');
    this.listHighlightsStmt = this.db.prepare(
      `SELECT id, user_id, book_id, page, rects, created_at, updated_at
       FROM highlights
       WHERE user_id = ? AND book_id = ? AND page = ?
       ORDER BY created_at DESC`
    );
    this.listBookmarksStmt = this.db.prepare(
      `SELECT id, user_id, book_id, page, created_at
       FROM bookmarks
       WHERE user_id = ? AND book_id = ?
       ORDER BY page ASC`
    );
    this.insertBookmarkStmt = this.db.prepare(
      `INSERT INTO bookmarks (id, user_id, book_id, page, created_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    this.deleteBookmarkByPageStmt = this.db.prepare(
      `DELETE FROM bookmarks
       WHERE user_id = ? AND book_id = ? AND page = ?`
    );
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

  listNotes(userId: string, filters?: ListNotesFilters): Note[] {
    const safeUserId = asNonEmptyString(userId);
    if (!safeUserId) {
      return [];
    }

    const where: string[] = ['user_id = ?'];
    const params: Array<string> = [safeUserId];

    const safeBookId = filters?.bookId ? asNonEmptyString(filters.bookId) : null;
    if (safeBookId) {
      where.push('book_id = ?');
      params.push(safeBookId);
    }

    const safeQuery = filters?.q ? filters.q.trim() : '';
    if (safeQuery.length > 0) {
      where.push('content LIKE ?');
      params.push(`%${safeQuery}%`);
    }

    const stmt = this.db.prepare(
      `SELECT id, user_id, book_id, page, content, created_at, updated_at
       FROM notes
       WHERE ${where.join(' AND ')}
       ORDER BY updated_at DESC`
    );
    const rows = stmt.all(...params) as NoteRow[];
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

  updateNote(userId: string, noteId: string, content: string): Note | null {
    const safeUserId = asNonEmptyString(userId);
    const safeNoteId = asNonEmptyString(noteId);
    const safeContent = normalizeNoteContent(content);
    if (!safeUserId || !safeNoteId || !safeContent) {
      return null;
    }

    const now = Date.now();
    const result = this.updateNoteStmt.run(safeContent, now, safeUserId, safeNoteId);
    if (result.changes === 0) {
      return null;
    }

    const row = this.getNoteStmt.get(safeUserId, safeNoteId);
    return row ? toNote(row) : null;
  }

  insertHighlight(
    userId: string,
    bookId: string,
    page: number,
    rects: HighlightRect[],
    id: string,
    createdAt: number,
    updatedAt: number
  ): Highlight | null {
    const safeUserId = asNonEmptyString(userId);
    const safeBookId = asNonEmptyString(bookId);
    const safeId = asNonEmptyString(id);
    const safePage = normalizeLastPage(page);
    if (!safeUserId || !safeBookId || !safeId || !safePage || rects.length === 0) {
      return null;
    }

    this.insertHighlightStmt.run(
      safeId,
      safeUserId,
      safeBookId,
      safePage,
      JSON.stringify(rects),
      Math.floor(createdAt),
      Math.floor(updatedAt)
    );
    return {
      id: safeId,
      userId: safeUserId,
      bookId: safeBookId,
      page: safePage,
      rects,
      createdAt: Math.floor(createdAt),
      updatedAt: Math.floor(updatedAt)
    };
  }

  listHighlights(userId: string, bookId: string, page: number): Highlight[] {
    const safeUserId = asNonEmptyString(userId);
    const safeBookId = asNonEmptyString(bookId);
    const safePage = normalizeLastPage(page);
    if (!safeUserId || !safeBookId || !safePage) {
      return [];
    }

    const rows = this.listHighlightsStmt.all(safeUserId, safeBookId, safePage);
    const highlights: Highlight[] = [];
    for (const row of rows) {
      const parsed = toHighlight(row);
      if (parsed) {
        highlights.push(parsed);
      }
    }
    return highlights;
  }

  deleteHighlights(userId: string, ids: string[]): void {
    const safeUserId = asNonEmptyString(userId);
    if (!safeUserId) {
      return;
    }
    const safeIds = ids.map((id) => id.trim()).filter((id) => id.length > 0);
    if (safeIds.length === 0) {
      return;
    }
    this.deleteHighlightsByIdsStmt.run({ user_id: safeUserId, ids_json: JSON.stringify(safeIds) });
  }

  deleteHighlight(userId: string, highlightId: string): boolean {
    const safeUserId = asNonEmptyString(userId);
    const safeHighlightId = asNonEmptyString(highlightId);
    if (!safeUserId || !safeHighlightId) {
      return false;
    }
    const result = this.deleteHighlightStmt.run(safeHighlightId, safeUserId);
    return result.changes > 0;
  }

  createMergedHighlight(
    userId: string,
    bookId: string,
    page: number,
    rects: HighlightRect[],
    id: string,
    createdAt: number,
    updatedAt: number,
    removeIds: string[]
  ): Highlight | null {
    const run = this.db.transaction(() => {
      this.deleteHighlights(userId, removeIds);
      return this.insertHighlight(userId, bookId, page, rects, id, createdAt, updatedAt);
    });
    return run();
  }

  listBookmarks(userId: string, bookId: string): Bookmark[] {
    const safeUserId = asNonEmptyString(userId);
    const safeBookId = asNonEmptyString(bookId);
    if (!safeUserId || !safeBookId) {
      return [];
    }
    const rows = this.listBookmarksStmt.all(safeUserId, safeBookId);
    return rows.map(toBookmark);
  }

  addBookmark(userId: string, bookId: string, page: number, id: string, createdAt: number): Bookmark | null {
    const safeUserId = asNonEmptyString(userId);
    const safeBookId = asNonEmptyString(bookId);
    const safePage = normalizeLastPage(page);
    const safeId = asNonEmptyString(id);
    if (!safeUserId || !safeBookId || !safePage || !safeId) {
      return null;
    }
    this.insertBookmarkStmt.run(safeId, safeUserId, safeBookId, safePage, Math.floor(createdAt));
    return {
      id: safeId,
      userId: safeUserId,
      bookId: safeBookId,
      page: safePage,
      createdAt: Math.floor(createdAt)
    };
  }

  removeBookmark(userId: string, bookId: string, page: number): boolean {
    const safeUserId = asNonEmptyString(userId);
    const safeBookId = asNonEmptyString(bookId);
    const safePage = normalizeLastPage(page);
    if (!safeUserId || !safeBookId || !safePage) {
      return false;
    }
    const result = this.deleteBookmarkByPageStmt.run(safeUserId, safeBookId, safePage);
    return result.changes > 0;
  }

  toggleBookmark(userId: string, bookId: string, page: number, idFactory: () => string): boolean | null {
    const safeUserId = asNonEmptyString(userId);
    const safeBookId = asNonEmptyString(bookId);
    const safePage = normalizeLastPage(page);
    if (!safeUserId || !safeBookId || !safePage) {
      return null;
    }

    const run = this.db.transaction((): boolean => {
      try {
        this.insertBookmarkStmt.run(idFactory(), safeUserId, safeBookId, safePage, Date.now());
        return true;
      } catch (error) {
        if (!isBookmarkUniqueConstraintError(error)) {
          throw error;
        }
        this.deleteBookmarkByPageStmt.run(safeUserId, safeBookId, safePage);
        return false;
      }
    });
    return run();
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
