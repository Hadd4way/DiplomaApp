import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

type GetRow = { last_page: number };

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

export class ReaderProgressDb {
  private db: Database.Database;

  private getStmt: Database.Statement<[string, string], GetRow | undefined>;

  private upsertStmt: Database.Statement<[string, string, number, number]>;

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
}

let instance: ReaderProgressDb | null = null;

export function getReaderProgressDb(userDataPath: string): ReaderProgressDb {
  if (instance) {
    return instance;
  }

  instance = new ReaderProgressDb(userDataPath);
  return instance;
}
