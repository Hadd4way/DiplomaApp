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
function toNote(row) {
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
function toHighlight(row) {
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
    const rects = parsedRects.filter((item) => {
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
function toBookmark(row) {
    return {
        id: row.id,
        userId: row.user_id,
        bookId: row.book_id,
        page: row.page,
        createdAt: row.created_at
    };
}
function isBookmarkUniqueConstraintError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.message.includes('UNIQUE constraint failed: bookmarks.user_id, bookmarks.book_id, bookmarks.page');
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
        this.getStmt = this.db.prepare('SELECT last_page FROM reading_progress WHERE user_id = ? AND book_id = ? LIMIT 1');
        this.upsertStmt = this.db.prepare(`
      INSERT INTO reading_progress (user_id, book_id, last_page, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, book_id) DO UPDATE SET
        last_page = excluded.last_page,
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
        this.insertHighlightStmt = this.db.prepare(`INSERT INTO highlights (id, user_id, book_id, page, rects, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`);
        this.deleteHighlightsByIdsStmt = this.db.prepare(`DELETE FROM highlights
       WHERE user_id = @user_id
         AND id IN (SELECT value FROM json_each(@ids_json))`);
        this.deleteHighlightStmt = this.db.prepare('DELETE FROM highlights WHERE id = ? AND user_id = ?');
        this.listHighlightsStmt = this.db.prepare(`SELECT id, user_id, book_id, page, rects, created_at, updated_at
       FROM highlights
       WHERE user_id = ? AND book_id = ? AND page = ?
       ORDER BY created_at DESC`);
        this.listBookmarksStmt = this.db.prepare(`SELECT id, user_id, book_id, page, created_at
       FROM bookmarks
       WHERE user_id = ? AND book_id = ?
       ORDER BY page ASC`);
        this.insertBookmarkStmt = this.db.prepare(`INSERT INTO bookmarks (id, user_id, book_id, page, created_at)
       VALUES (?, ?, ?, ?, ?)`);
        this.deleteBookmarkByPageStmt = this.db.prepare(`DELETE FROM bookmarks
       WHERE user_id = ? AND book_id = ? AND page = ?`);
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
    createNote(note) {
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
    insertHighlight(userId, bookId, page, rects, id, createdAt, updatedAt) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        const safeId = asNonEmptyString(id);
        const safePage = normalizeLastPage(page);
        if (!safeUserId || !safeBookId || !safeId || !safePage || rects.length === 0) {
            return null;
        }
        this.insertHighlightStmt.run(safeId, safeUserId, safeBookId, safePage, JSON.stringify(rects), Math.floor(createdAt), Math.floor(updatedAt));
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
    listHighlights(userId, bookId, page) {
        const safeUserId = asNonEmptyString(userId);
        const safeBookId = asNonEmptyString(bookId);
        const safePage = normalizeLastPage(page);
        if (!safeUserId || !safeBookId || !safePage) {
            return [];
        }
        const rows = this.listHighlightsStmt.all(safeUserId, safeBookId, safePage);
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
    createMergedHighlight(userId, bookId, page, rects, id, createdAt, updatedAt, removeIds) {
        const run = this.db.transaction(() => {
            this.deleteHighlights(userId, removeIds);
            return this.insertHighlight(userId, bookId, page, rects, id, createdAt, updatedAt);
        });
        return run();
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
            userId: safeUserId,
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
