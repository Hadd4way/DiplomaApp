import type Database from 'better-sqlite3';
import type {
  BookFormat,
  RecentBookEntry,
  StatsGetRecentBooksResult,
  StatsMarkOpenedRequest,
  StatsMarkOpenedResult
} from '../shared/ipc';

type StatsBookRow = {
  book_id: string;
  title: string;
  format: BookFormat;
  last_opened_at: number | null;
};

function sanitizeBookId(bookId: string | undefined): string {
  return bookId?.trim() ?? '';
}

function isBookOwned(db: Database.Database, userId: string, bookId: string): boolean {
  const row = db
    .prepare(
      `SELECT id
       FROM books
       WHERE id = ? AND user_id = ?
       LIMIT 1`
    )
    .get(bookId, userId) as { id: string } | undefined;

  return Boolean(row);
}

function toEntry(row: StatsBookRow): RecentBookEntry {
  return {
    bookId: row.book_id,
    title: row.title,
    format: row.format,
    lastOpenedAt: row.last_opened_at
  };
}

export function markBookOpened(
  db: Database.Database,
  userId: string,
  payload: StatsMarkOpenedRequest
): StatsMarkOpenedResult {
  const bookId = sanitizeBookId(payload.bookId);
  if (!bookId) {
    return { ok: false, error: 'Book not found.' };
  }
  if (!isBookOwned(db, userId, bookId)) {
    return { ok: false, error: 'Book not found.' };
  }

  const now = Date.now();
  db.prepare(
    `INSERT INTO reading_stats (
       book_id,
       total_reading_time_sec,
       last_opened_at,
       open_count,
       last_format,
       updated_at
     )
     VALUES (?, 0, ?, 1, ?, ?)
     ON CONFLICT(book_id) DO UPDATE SET
       open_count = reading_stats.open_count + 1,
       last_opened_at = excluded.last_opened_at,
       last_format = excluded.last_format,
       updated_at = excluded.updated_at`
  ).run(bookId, now, payload.format, now);

  return { ok: true };
}

export function getRecentBooks(db: Database.Database, userId: string): StatsGetRecentBooksResult {
  const recentBooks = db
    .prepare(
      `SELECT
         b.id AS book_id,
         b.title,
         b.format,
         rs.last_opened_at
       FROM reading_stats AS rs
       INNER JOIN books AS b ON b.id = rs.book_id
       WHERE b.user_id = ?
         AND rs.last_opened_at IS NOT NULL
       ORDER BY rs.last_opened_at DESC, b.title COLLATE NOCASE ASC
       LIMIT 5`
    )
    .all(userId) as StatsBookRow[];

  return {
    ok: true,
    books: recentBooks.map(toEntry)
  };
}
