import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  Book,
  BooksAddSampleRequest,
  BooksAddSampleResult,
  BooksListRequest,
  BooksListResult
} from '../shared/ipc';
import { resolveSessionUserId } from './auth';

type BookRow = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  format: 'pdf' | 'epub';
  file_path: string | null;
  created_at: number;
};

function toBook(row: BookRow): Book {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    author: row.author,
    format: row.format,
    filePath: row.file_path,
    createdAt: row.created_at
  };
}

export function listBooks(db: Database.Database, payload: BooksListRequest): BooksListResult {
  const session = resolveSessionUserId(db, payload.token);
  if (!session.ok) {
    return session;
  }

  const rows = db
    .prepare(
      `SELECT id, user_id, title, author, format, file_path, created_at
       FROM books
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .all(session.userId) as BookRow[];

  return {
    ok: true,
    books: rows.map(toBook)
  };
}

export function addSampleBook(
  db: Database.Database,
  payload: BooksAddSampleRequest
): BooksAddSampleResult {
  const session = resolveSessionUserId(db, payload.token);
  if (!session.ok) {
    return session;
  }

  const sampleCountRow = db
    .prepare('SELECT COUNT(*) AS count FROM books WHERE user_id = ?')
    .get(session.userId) as { count: number };

  const sampleNumber = sampleCountRow.count + 1;
  const format: 'pdf' | 'epub' = sampleNumber % 2 === 1 ? 'pdf' : 'epub';
  const now = Date.now();
  const book: Book = {
    id: randomUUID(),
    userId: session.userId,
    title: `Sample Book ${sampleNumber}`,
    author: null,
    format,
    filePath: null,
    createdAt: now
  };

  db.prepare(
    `INSERT INTO books (id, user_id, title, author, format, file_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(book.id, book.userId, book.title, book.author, book.format, book.filePath, book.createdAt);

  return { ok: true, book };
}

