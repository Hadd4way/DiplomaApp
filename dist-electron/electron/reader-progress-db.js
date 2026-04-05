"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReaderProgressDb = void 0;
exports.getReaderProgressDb = getReaderProgressDb;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
function asNonEmptyString(value) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function normalizeLastPage(value) {
    if (!Number.isFinite(value)) {
        return null;
    }
    const page = Math.floor(value);
    return page >= 1 ? page : null;
}
function normalizeNoteContent(value) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function normalizeHighlightText(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > 0 ? normalized : null;
}
function normalizeHighlightNote(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
}
function toNote(row) {
    return {
        id: row.id,
        bookId: row.book_id,
        page: row.page,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
function toHighlight(row) {
    let rects = [];
    if (typeof row.rects === 'string' && row.rects.trim().length > 0) {
        let parsedRects;
        try {
            parsedRects = JSON.parse(row.rects);
        }
        catch {
            return null;
        }
        if (!Array.isArray(parsedRects)) {
            return null;
        }
        rects = parsedRects.filter((item) => {
            if (!item || typeof item !== 'object') {
                return false;
            }
            const rect = item;
            return (typeof rect.x === 'number' &&
                Number.isFinite(rect.x) &&
                typeof rect.y === 'number' &&
                Number.isFinite(rect.y) &&
                typeof rect.w === 'number' &&
                Number.isFinite(rect.w) &&
                typeof rect.h === 'number' &&
                Number.isFinite(rect.h));
        });
    }
    const cfiRange = typeof row.cfi_range === 'string' && row.cfi_range.trim().length > 0 ? row.cfi_range.trim() : null;
    const page = row.page === null ? null : normalizeLastPage(row.page);
    if (rects.length === 0 && !cfiRange) {
        return null;
    }
    return {
        id: row.id,
        bookId: row.book_id,
        page,
        rects,
        cfiRange,
        text: normalizeHighlightText(row.text),
        note: normalizeHighlightNote(row.note),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
function toBookmark(row) {
    return {
        id: row.id,
        bookId: row.book_id,
        page: row.page,
        createdAt: row.created_at
    };
}
function toEpubBookmark(row) {
    return {
        id: row.id,
        bookId: row.book_id,
        cfi: row.cfi,
        label: normalizeHighlightNote(row.label),
        createdAt: row.created_at
    };
}
function isBookmarkUniqueConstraintError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.message.includes('UNIQUE constraint failed: bookmarks.user_id, bookmarks.book_id, bookmarks.page');
}
function isEpubBookmarkUniqueConstraintError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.message.includes('UNIQUE constraint failed: epub_bookmarks.user_id, epub_bookmarks.book_id, epub_bookmarks.cfi');
}
class ReaderProgressDb {
    ensureHighlightsSchema() {
        const rows = this.db.prepare('PRAGMA table_info(highlights)').all();
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
        if (!columns.has('text')) {
            this.db.exec('ALTER TABLE highlights ADD COLUMN text TEXT');
        }
        if (!columns.has('note')) {
            this.db.exec('ALTER TABLE highlights ADD COLUMN note TEXT');
        }
        const normalizedRows = this.db.prepare('PRAGMA table_info(highlights)').all();
        const normalizedColumns = new Set(normalizedRows.map((row) => row.name));
        const pageColumn = normalizedRows.find((row) => row.name === 'page');
        const rectsColumn = normalizedRows.find((row) => row.name === 'rects');
        const needsTableRebuild = !normalizedColumns.has('cfi_range') || Boolean(pageColumn && pageColumn.notnull) || Boolean(rectsColumn && rectsColumn.notnull);
        if (needsTableRebuild) {
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS highlights_v2 (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          book_id TEXT NOT NULL,
          page INTEGER NULL,
          rects TEXT NULL,
          cfi_range TEXT NULL,
          text TEXT,
          note TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        INSERT INTO highlights_v2 (id, user_id, book_id, page, rects, cfi_range, text, note, created_at, updated_at)
        SELECT
          id,
          user_id,
          book_id,
          page,
          rects,
          NULL AS cfi_range,
          text,
          note,
          created_at,
          updated_at
        FROM highlights;

        DROP TABLE highlights;
        ALTER TABLE highlights_v2 RENAME TO highlights;
      `);
        }
        const refreshedRows = this.db.prepare('PRAGMA table_info(highlights)').all();
        const refreshedColumns = new Set(refreshedRows.map((row) => row.name));
        if (!refreshedColumns.has('cfi_range')) {
            this.db.exec('ALTER TABLE highlights ADD COLUMN cfi_range TEXT');
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

      CREATE INDEX IF NOT EXISTS idx_highlights_user_book_page ON highlights(user_id, book_id, page);
      CREATE INDEX IF NOT EXISTS idx_highlights_user_book_cfi ON highlights(user_id, book_id, cfi_range);
    `);
    }
    constructor(userDataPath) {
        node_fs_1.default.mkdirSync(userDataPath, { recursive: true });
        const dbPath = node_path_1.default.join(userDataPath, 'reader.db');
        this.db = new better_sqlite3_1.default(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS reading_progress (
        user_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        last_page INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, book_id)
      );

      CREATE TABLE IF NOT EXISTS reading_progress_epub (
        user_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        last_cfi TEXT NOT NULL,
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
        page INTEGER NULL,
        rects TEXT NULL,
        cfi_range TEXT NULL,
        text TEXT,
        note TEXT,
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

      CREATE TABLE IF NOT EXISTS epub_bookmarks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        cfi TEXT NOT NULL,
        label TEXT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(user_id, book_id, cfi)
      );

      CREATE INDEX IF NOT EXISTS idx_notes_user_created_at ON notes(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notes_user_book_page ON notes(user_id, book_id, page);
      CREATE INDEX IF NOT EXISTS idx_highlights_user_book_page ON highlights(user_id, book_id, page);
      CREATE INDEX IF NOT EXISTS idx_highlights_user_book_cfi ON highlights(user_id, book_id, cfi_range);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_user_book_created_at ON bookmarks(user_id, book_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_user_book_page ON bookmarks(user_id, book_id, page);
      CREATE INDEX IF NOT EXISTS idx_epub_bookmarks_user_book_created_at ON epub_bookmarks(user_id, book_id, created_at DESC);
    `);
        this.ensureHighlightsSchema();
        this.getStmt = this.db.prepare('SELECT last_page FROM reading_progress WHERE user_id = ? AND book_id = ? LIMIT 1');
        this.getEpubStmt = this.db.prepare('SELECT last_cfi FROM reading_progress_epub WHERE user_id = ? AND book_id = ? LIMIT 1');
        this.upsertStmt = this.db.prepare(`
      INSERT INTO reading_progress (user_id, book_id, last_page, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, book_id) DO UPDATE SET
        last_page = excluded.last_page,
        updated_at = excluded.updated_at
    `);
        this.upsertEpubStmt = this.db.prepare(`
      INSERT INTO reading_progress_epub (user_id, book_id, last_cfi, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, book_id) DO UPDATE SET
        last_cfi = excluded.last_cfi,
        updated_at = excluded.updated_at
    `);
        this.insertNoteStmt = this.db.prepare(`INSERT INTO notes (id, user_id, book_id, page, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`);
        this.deleteNoteStmt = this.db.prepare('DELETE FROM notes WHERE user_id = ? AND id = ?');
        this.updateNoteStmt = this.db.prepare(`UPDATE notes
       SET content = ?, updated_at = ?
       WHERE user_id = ? AND id = ?`);
        this.getNoteStmt = this.db.prepare(`SELECT id, user_id, book_id, page, content, created_at, updated_at
       FROM notes
       WHERE user_id = ? AND id = ?
       LIMIT 1`);
        this.insertHighlightStmt = this.db.prepare(`INSERT INTO highlights (id, user_id, book_id, page, rects, cfi_range, text, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        this.updateHighlightNoteStmt = this.db.prepare(`UPDATE highlights
       SET note = ?, updated_at = ?
       WHERE user_id = ? AND id = ?`);
        this.getHighlightStmt = this.db.prepare(`SELECT id, user_id, book_id, page, rects, cfi_range, text, note, created_at, updated_at
       FROM highlights
       WHERE user_id = ? AND id = ?
       LIMIT 1`);
        this.deleteHighlightsByIdsStmt = this.db.prepare(`DELETE FROM highlights
       WHERE user_id = @user_id
         AND id IN (SELECT value FROM json_each(@ids_json))`);
        this.deleteHighlightStmt = this.db.prepare('DELETE FROM highlights WHERE id = ? AND user_id = ?');
        this.listHighlightsByPageStmt = this.db.prepare(`SELECT id, user_id, book_id, page, rects, cfi_range, text, note, created_at, updated_at
       FROM highlights
       WHERE user_id = ? AND book_id = ? AND page = ?
       ORDER BY created_at DESC`);
        this.listNotesByBookForExportStmt = this.db.prepare(`SELECT id, user_id, book_id, page, content, created_at, updated_at
       FROM notes
       WHERE user_id = ? AND book_id = ?
       ORDER BY page ASC, created_at ASC`);
        this.listHighlightsByBookStmt = this.db.prepare(`SELECT id, user_id, book_id, page, rects, cfi_range, text, note, created_at, updated_at
       FROM highlights
       WHERE user_id = ? AND book_id = ?
       ORDER BY CASE WHEN page IS NULL THEN 1 ELSE 0 END ASC, page ASC, created_at ASC`);
        this.listBookmarksStmt = this.db.prepare(`SELECT id, user_id, book_id, page, created_at
       FROM bookmarks
       WHERE user_id = ? AND book_id = ?
       ORDER BY page ASC`);
        this.insertBookmarkStmt = this.db.prepare(`INSERT INTO bookmarks (id, user_id, book_id, page, created_at)
       VALUES (?, ?, ?, ?, ?)`);
        this.deleteBookmarkByPageStmt = this.db.prepare(`DELETE FROM bookmarks
       WHERE user_id = ? AND book_id = ? AND page = ?`);
        this.listEpubBookmarksStmt = this.db.prepare(`SELECT id, user_id, book_id, cfi, label, created_at
       FROM epub_bookmarks
       WHERE user_id = ? AND book_id = ?
       ORDER BY created_at ASC`);
        this.getEpubBookmarkByCfiStmt = this.db.prepare(`SELECT id, user_id, book_id, cfi, label, created_at
       FROM epub_bookmarks
       WHERE user_id = ? AND book_id = ? AND cfi = ?
       LIMIT 1`);
        this.insertEpubBookmarkStmt = this.db.prepare(`INSERT INTO epub_bookmarks (id, user_id, book_id, cfi, label, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`);
        this.deleteEpubBookmarkByCfiStmt = this.db.prepare(`DELETE FROM epub_bookmarks
       WHERE user_id = ? AND book_id = ? AND cfi = ?`);
    }
    getLastPage(userId, bookId) {
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
    setLastPage(userId, bookId, lastPage) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        const safeLastPage = normalizeLastPage(lastPage);
        if (!safeUserId || !safeBookId || !safeLastPage) {
            return;
        }
        this.upsertStmt.run(safeUserId, safeBookId, safeLastPage, Date.now());
    }
    getLastEpubCfi(userId, bookId) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        if (!safeUserId || !safeBookId) {
            return null;
        }
        const row = this.getEpubStmt.get(safeUserId, safeBookId);
        if (!row || typeof row.last_cfi !== 'string') {
            return null;
        }
        const cfi = row.last_cfi.trim();
        return cfi.length > 0 ? cfi : null;
    }
    setLastEpubCfi(userId, bookId, cfi) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        const safeCfi = asNonEmptyString(cfi);
        if (!safeUserId || !safeBookId || !safeCfi) {
            return;
        }
        this.upsertEpubStmt.run(safeUserId, safeBookId, safeCfi, Date.now());
    }
    createNote(userId, note) {
        const safeUserId = asNonEmptyString(userId);
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
            bookId: safeBookId,
            page: safePage,
            content: safeContent,
            createdAt,
            updatedAt: now
        };
    }
    listNotes(userId, filters) {
        const safeUserId = asNonEmptyString(userId);
        if (!safeUserId) {
            return [];
        }
        const where = ['user_id = ?'];
        const params = [safeUserId];
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
        const stmt = this.db.prepare(`SELECT id, user_id, book_id, page, content, created_at, updated_at
       FROM notes
       WHERE ${where.join(' AND ')}
       ORDER BY updated_at DESC`);
        const rows = stmt.all(...params);
        return rows.map(toNote);
    }
    deleteNote(userId, noteId) {
        const safeUserId = asNonEmptyString(userId);
        const safeNoteId = asNonEmptyString(noteId);
        if (!safeUserId || !safeNoteId) {
            return false;
        }
        const result = this.deleteNoteStmt.run(safeUserId, safeNoteId);
        return result.changes > 0;
    }
    updateNote(userId, noteId, content) {
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
    insertHighlight(userId, bookId, page, rects, cfiRange, text, note, id, createdAt, updatedAt) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        const safeId = asNonEmptyString(id);
        const safePage = page === null || page === undefined ? null : normalizeLastPage(page);
        const safeCfiRange = cfiRange ? asNonEmptyString(cfiRange) : null;
        const safeRects = Array.isArray(rects) ? rects : [];
        if (!safeUserId || !safeBookId || !safeId) {
            return null;
        }
        if ((safePage === null || safeRects.length === 0) && !safeCfiRange) {
            return null;
        }
        this.insertHighlightStmt.run(safeId, safeUserId, safeBookId, safePage, safeRects.length > 0 ? JSON.stringify(safeRects) : null, safeCfiRange, normalizeHighlightText(text), normalizeHighlightNote(note), Math.floor(createdAt), Math.floor(updatedAt));
        return {
            id: safeId,
            bookId: safeBookId,
            page: safePage,
            rects: safeRects,
            cfiRange: safeCfiRange,
            text: normalizeHighlightText(text),
            note: normalizeHighlightNote(note),
            createdAt: Math.floor(createdAt),
            updatedAt: Math.floor(updatedAt)
        };
    }
    updateHighlightNote(userId, highlightId, note) {
        const safeUserId = asNonEmptyString(userId);
        const safeHighlightId = asNonEmptyString(highlightId);
        if (!safeUserId || !safeHighlightId) {
            return null;
        }
        const now = Date.now();
        const result = this.updateHighlightNoteStmt.run(normalizeHighlightNote(note), now, safeUserId, safeHighlightId);
        if (result.changes === 0) {
            return null;
        }
        const row = this.getHighlightStmt.get(safeUserId, safeHighlightId);
        return row ? toHighlight(row) : null;
    }
    listHighlights(userId, bookId, page) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        if (!safeUserId || !safeBookId) {
            return [];
        }
        const safePage = page === null || page === undefined ? null : normalizeLastPage(page);
        const rows = safePage === null
            ? this.listHighlightsByBookStmt.all(safeUserId, safeBookId)
            : this.listHighlightsByPageStmt.all(safeUserId, safeBookId, safePage);
        const highlights = [];
        for (const row of rows) {
            const parsed = toHighlight(row);
            if (parsed) {
                highlights.push(parsed);
            }
        }
        return highlights;
    }
    deleteHighlights(userId, ids) {
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
    deleteHighlight(userId, highlightId) {
        const safeUserId = asNonEmptyString(userId);
        const safeHighlightId = asNonEmptyString(highlightId);
        if (!safeUserId || !safeHighlightId) {
            return false;
        }
        const result = this.deleteHighlightStmt.run(safeHighlightId, safeUserId);
        return result.changes > 0;
    }
    createMergedHighlight(userId, bookId, page, rects, text, note, id, createdAt, updatedAt, removeIds) {
        const run = this.db.transaction(() => {
            this.deleteHighlights(userId, removeIds);
            return this.insertHighlight(userId, bookId, page, rects, null, text, note, id, createdAt, updatedAt);
        });
        return run();
    }
    listNotesByBookForExport(userId, bookId) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        if (!safeUserId || !safeBookId) {
            return [];
        }
        const rows = this.listNotesByBookForExportStmt.all(safeUserId, safeBookId);
        return rows.map(toNote);
    }
    listHighlightsByBook(userId, bookId) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        if (!safeUserId || !safeBookId) {
            return [];
        }
        const rows = this.listHighlightsByBookStmt.all(safeUserId, safeBookId);
        const highlights = [];
        for (const row of rows) {
            const parsed = toHighlight(row);
            if (parsed) {
                highlights.push(parsed);
            }
        }
        return highlights;
    }
    listBookmarks(userId, bookId) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        if (!safeUserId || !safeBookId) {
            return [];
        }
        const rows = this.listBookmarksStmt.all(safeUserId, safeBookId);
        return rows.map(toBookmark);
    }
    addBookmark(userId, bookId, page, id, createdAt) {
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
            bookId: safeBookId,
            page: safePage,
            createdAt: Math.floor(createdAt)
        };
    }
    removeBookmark(userId, bookId, page) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        const safePage = normalizeLastPage(page);
        if (!safeUserId || !safeBookId || !safePage) {
            return false;
        }
        const result = this.deleteBookmarkByPageStmt.run(safeUserId, safeBookId, safePage);
        return result.changes > 0;
    }
    toggleBookmark(userId, bookId, page, idFactory) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        const safePage = normalizeLastPage(page);
        if (!safeUserId || !safeBookId || !safePage) {
            return null;
        }
        const run = this.db.transaction(() => {
            try {
                this.insertBookmarkStmt.run(idFactory(), safeUserId, safeBookId, safePage, Date.now());
                return true;
            }
            catch (error) {
                if (!isBookmarkUniqueConstraintError(error)) {
                    throw error;
                }
                this.deleteBookmarkByPageStmt.run(safeUserId, safeBookId, safePage);
                return false;
            }
        });
        return run();
    }
    listEpubBookmarks(userId, bookId) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        if (!safeUserId || !safeBookId) {
            return [];
        }
        const rows = this.listEpubBookmarksStmt.all(safeUserId, safeBookId);
        return rows.map(toEpubBookmark);
    }
    toggleEpubBookmark(userId, bookId, cfi, label, idFactory) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        const safeCfi = asNonEmptyString(cfi);
        if (!safeUserId || !safeBookId || !safeCfi) {
            return null;
        }
        const safeLabel = normalizeHighlightNote(label);
        const run = this.db.transaction(() => {
            try {
                const safeId = asNonEmptyString(idFactory());
                if (!safeId) {
                    throw new Error('Invalid bookmark id');
                }
                const createdAt = Date.now();
                this.insertEpubBookmarkStmt.run(safeId, safeUserId, safeBookId, safeCfi, safeLabel, createdAt);
                const inserted = this.getEpubBookmarkByCfiStmt.get(safeUserId, safeBookId, safeCfi) ??
                    {
                        id: safeId,
                        user_id: safeUserId,
                        book_id: safeBookId,
                        cfi: safeCfi,
                        label: safeLabel,
                        created_at: createdAt
                    };
                return { bookmarked: true, bookmark: toEpubBookmark(inserted) };
            }
            catch (error) {
                if (!isEpubBookmarkUniqueConstraintError(error)) {
                    throw error;
                }
                this.deleteEpubBookmarkByCfiStmt.run(safeUserId, safeBookId, safeCfi);
                return { bookmarked: false, bookmark: null };
            }
        });
        return run();
    }
    migrateLegacyUserData(localUserId) {
        const safeLocalUserId = asNonEmptyString(localUserId);
        if (!safeLocalUserId) {
            return;
        }
        const localCountRow = this.db
            .prepare(`SELECT
           (SELECT COUNT(*) FROM reading_progress WHERE user_id = ?) +
           (SELECT COUNT(*) FROM reading_progress_epub WHERE user_id = ?) +
           (SELECT COUNT(*) FROM notes WHERE user_id = ?) +
           (SELECT COUNT(*) FROM highlights WHERE user_id = ?) +
           (SELECT COUNT(*) FROM bookmarks WHERE user_id = ?) +
           (SELECT COUNT(*) FROM epub_bookmarks WHERE user_id = ?) AS count`)
            .get(safeLocalUserId, safeLocalUserId, safeLocalUserId, safeLocalUserId, safeLocalUserId, safeLocalUserId);
        if (localCountRow.count > 0) {
            return;
        }
        const legacyUserRows = this.db
            .prepare(`SELECT DISTINCT user_id
         FROM (
           SELECT user_id FROM reading_progress
           UNION
           SELECT user_id FROM reading_progress_epub
           UNION
           SELECT user_id FROM notes
           UNION
           SELECT user_id FROM highlights
           UNION
           SELECT user_id FROM bookmarks
           UNION
           SELECT user_id FROM epub_bookmarks
         )
         WHERE user_id != ?
         ORDER BY user_id ASC`)
            .all(safeLocalUserId);
        if (legacyUserRows.length !== 1) {
            return;
        }
        const legacyUserId = legacyUserRows[0].user_id;
        const migrate = this.db.transaction(() => {
            this.db.prepare('UPDATE reading_progress SET user_id = ? WHERE user_id = ?').run(safeLocalUserId, legacyUserId);
            this.db
                .prepare('UPDATE reading_progress_epub SET user_id = ? WHERE user_id = ?')
                .run(safeLocalUserId, legacyUserId);
            this.db.prepare('UPDATE notes SET user_id = ? WHERE user_id = ?').run(safeLocalUserId, legacyUserId);
            this.db.prepare('UPDATE highlights SET user_id = ? WHERE user_id = ?').run(safeLocalUserId, legacyUserId);
            this.db.prepare('UPDATE bookmarks SET user_id = ? WHERE user_id = ?').run(safeLocalUserId, legacyUserId);
            this.db.prepare('UPDATE epub_bookmarks SET user_id = ? WHERE user_id = ?').run(safeLocalUserId, legacyUserId);
        });
        migrate();
    }
}
exports.ReaderProgressDb = ReaderProgressDb;
let instance = null;
function getReaderProgressDb(userDataPath) {
    if (instance) {
        return instance;
    }
    instance = new ReaderProgressDb(userDataPath);
    return instance;
}
