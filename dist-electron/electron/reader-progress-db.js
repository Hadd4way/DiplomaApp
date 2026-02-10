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
class ReaderProgressDb {
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
    `);
        this.getStmt = this.db.prepare('SELECT last_page FROM reading_progress WHERE user_id = ? AND book_id = ? LIMIT 1');
        this.upsertStmt = this.db.prepare(`
      INSERT INTO reading_progress (user_id, book_id, last_page, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, book_id) DO UPDATE SET
        last_page = excluded.last_page,
        updated_at = excluded.updated_at
    `);
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
