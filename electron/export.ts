import fs from 'node:fs/promises';
import path from 'node:path';
import { dialog, type BrowserWindow } from 'electron';
import type Database from 'better-sqlite3';
import type {
  Book,
  ExportGetBookDataRequest,
  ExportGetBookDataResult,
  ExportSaveFileRequest,
  ExportSaveFileResult
} from '../shared/ipc';
import type { ReaderProgressDb } from './reader-progress-db';

type BookRow = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  format: 'pdf' | 'epub' | 'fb2' | 'txt';
  file_path: string | null;
  created_at: number;
};

function toBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    format: row.format,
    filePath: row.file_path,
    createdAt: row.created_at
  };
}

function sanitizeFilename(value: string): string {
  const trimmed = value.trim();
  const fallback = 'book-export';
  const safe = (trimmed || fallback).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\s+/g, ' ');
  return safe.slice(0, 120).trim() || fallback;
}

export function getBookExportData(
  authDb: Database.Database,
  readerDb: ReaderProgressDb,
  userId: string,
  payload: ExportGetBookDataRequest
): ExportGetBookDataResult {
  const bookId = payload.bookId?.trim();
  if (!bookId) {
    return { ok: false, error: 'Book not found' };
  }

  const row = authDb
    .prepare(
      `SELECT id, user_id, title, author, format, file_path, created_at
       FROM books
       WHERE id = ? AND user_id = ?
       LIMIT 1`
    )
    .get(bookId, userId) as BookRow | undefined;

  if (!row) {
    return { ok: false, error: 'Book not found' };
  }

  return {
    ok: true,
    data: {
      book: toBook(row),
      notes: readerDb.listNotesByBookForExport(userId, bookId),
      highlights: readerDb.listHighlightsByBook(userId, bookId)
    }
  };
}

export async function saveExportFile(
  payload: ExportSaveFileRequest,
  ownerWindow: BrowserWindow | null
): Promise<ExportSaveFileResult> {
  const ext = payload.ext === 'json' ? 'json' : 'md';
  const content = typeof payload.content === 'string' ? payload.content : '';
  const baseName = sanitizeFilename(payload.suggestedName || 'book-export');
  const finalName = baseName.toLowerCase().endsWith(`.${ext}`) ? baseName : `${baseName}.${ext}`;

  const saveResult = ownerWindow
    ? await dialog.showSaveDialog(ownerWindow, {
        title: 'Save export',
        defaultPath: finalName,
        filters: [{ name: ext === 'md' ? 'Markdown' : 'JSON', extensions: [ext] }]
      })
    : await dialog.showSaveDialog({
        title: 'Save export',
        defaultPath: finalName,
        filters: [{ name: ext === 'md' ? 'Markdown' : 'JSON', extensions: [ext] }]
      });

  if (saveResult.canceled || !saveResult.filePath) {
    return { ok: false, cancelled: true };
  }

  try {
    await fs.mkdir(path.dirname(saveResult.filePath), { recursive: true });
    await fs.writeFile(saveResult.filePath, content, 'utf8');
    return { ok: true, path: saveResult.filePath };
  } catch {
    return { ok: false, error: 'Failed to save export file.' };
  }
}
