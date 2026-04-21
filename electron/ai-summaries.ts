import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  AiSummaryEntry,
  AiSummaryFlashcard,
  AiSummariesDeleteRequest,
  AiSummariesDeleteResult,
  AiSummariesGetRequest,
  AiSummariesGetResult,
  AiSummariesListResult,
  AiSummariesSaveRequest,
  AiSummariesSaveResult
} from '../shared/ipc';

type AiSummaryRow = {
  id: string;
  book_id: string | null;
  book_title: string;
  author: string | null;
  language: 'ru' | 'en';
  summary: string;
  key_ideas_json: string;
  study_notes_json: string;
  flashcards_json: string;
  created_at: number;
  updated_at: number;
};

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseFlashcards(value: string): AiSummaryFlashcard[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const question = 'question' in item && typeof item.question === 'string' ? item.question.trim() : '';
      const answer = 'answer' in item && typeof item.answer === 'string' ? item.answer.trim() : '';
      if (!question || !answer) {
        return [];
      }

      return [{ question, answer }];
    });
  } catch {
    return [];
  }
}

function toEntry(row: AiSummaryRow): AiSummaryEntry {
  return {
    id: row.id,
    bookId: row.book_id,
    bookTitle: row.book_title,
    author: row.author,
    language: row.language,
    summary: row.summary,
    keyIdeas: parseStringArray(row.key_ideas_json),
    studyNotes: parseStringArray(row.study_notes_json),
    flashcards: parseFlashcards(row.flashcards_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeStringArray(items: string[]): string[] {
  return items
    .map((item) => item.trim())
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
}

function normalizeFlashcards(items: AiSummaryFlashcard[]): AiSummaryFlashcard[] {
  return items.flatMap((item) => {
    const question = item.question.trim();
    const answer = item.answer.trim();
    return question && answer ? [{ question, answer }] : [];
  });
}

export function saveAiSummary(authDb: Database.Database, payload: AiSummariesSaveRequest): AiSummariesSaveResult {
  const bookTitle = payload.bookTitle?.trim();
  if (!bookTitle) {
    return { ok: false, error: 'Book title is required.' };
  }

  const summary = payload.summary?.trim();
  if (!summary) {
    return { ok: false, error: 'Summary is required.' };
  }

  const language = payload.language === 'ru' ? 'ru' : payload.language === 'en' ? 'en' : null;
  if (!language) {
    return { ok: false, error: 'Language is required.' };
  }

  const id = payload.id?.trim() || randomUUID();
  const bookId = payload.bookId?.trim() || null;
  const author = payload.author?.trim() || null;
  const keyIdeas = normalizeStringArray(payload.keyIdeas ?? []);
  const studyNotes = normalizeStringArray(payload.studyNotes ?? []);
  const flashcards = normalizeFlashcards(payload.flashcards ?? []);
  const now = Date.now();

  const existing = authDb
    .prepare(
      `SELECT created_at
       FROM ai_summaries
       WHERE id = ?
       LIMIT 1`
    )
    .get(id) as { created_at: number } | undefined;

  authDb
    .prepare(
      `INSERT INTO ai_summaries (
         id,
         book_id,
         book_title,
         author,
         language,
         summary,
         key_ideas_json,
         study_notes_json,
         flashcards_json,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         book_id = excluded.book_id,
         book_title = excluded.book_title,
         author = excluded.author,
         language = excluded.language,
         summary = excluded.summary,
         key_ideas_json = excluded.key_ideas_json,
         study_notes_json = excluded.study_notes_json,
         flashcards_json = excluded.flashcards_json,
         updated_at = excluded.updated_at`
    )
    .run(
      id,
      bookId,
      bookTitle,
      author,
      language,
      summary,
      JSON.stringify(keyIdeas),
      JSON.stringify(studyNotes),
      JSON.stringify(flashcards),
      existing?.created_at ?? now,
      now
    );

  const row = authDb
    .prepare(
      `SELECT id, book_id, book_title, author, language, summary, key_ideas_json, study_notes_json, flashcards_json, created_at, updated_at
       FROM ai_summaries
       WHERE id = ?
       LIMIT 1`
    )
    .get(id) as AiSummaryRow | undefined;

  if (!row) {
    return { ok: false, error: 'Failed to save AI summary.' };
  }

  return { ok: true, entry: toEntry(row) };
}

export function listAiSummaries(authDb: Database.Database): AiSummariesListResult {
  const rows = authDb
    .prepare(
      `SELECT id, book_id, book_title, author, language, summary, key_ideas_json, study_notes_json, flashcards_json, created_at, updated_at
       FROM ai_summaries
       ORDER BY created_at DESC`
    )
    .all() as AiSummaryRow[];

  return { ok: true, entries: rows.map(toEntry) };
}

export function getAiSummary(authDb: Database.Database, payload: AiSummariesGetRequest): AiSummariesGetResult {
  const id = payload.id?.trim();
  if (!id) {
    return { ok: false, error: 'AI summary not found.' };
  }

  const row = authDb
    .prepare(
      `SELECT id, book_id, book_title, author, language, summary, key_ideas_json, study_notes_json, flashcards_json, created_at, updated_at
       FROM ai_summaries
       WHERE id = ?
       LIMIT 1`
    )
    .get(id) as AiSummaryRow | undefined;

  return { ok: true, entry: row ? toEntry(row) : null };
}

export function deleteAiSummary(authDb: Database.Database, payload: AiSummariesDeleteRequest): AiSummariesDeleteResult {
  const id = payload.id?.trim();
  if (!id) {
    return { ok: false, error: 'AI summary not found.' };
  }

  const result = authDb
    .prepare(
      `DELETE FROM ai_summaries
       WHERE id = ?`
    )
    .run(id);

  if (result.changes === 0) {
    return { ok: false, error: 'AI summary not found.' };
  }

  return { ok: true };
}
