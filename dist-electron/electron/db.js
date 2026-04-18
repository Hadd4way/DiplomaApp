"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_DB_ID = void 0;
exports.getDatabase = getDatabase;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
let dbInstance = null;
exports.LOCAL_DB_ID = 'local-user';
function hasColumn(db, tableName, columnName) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some((column) => column.name === columnName);
}
function ensureBooksFormatSchema(db) {
    const row = db
        .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'books' LIMIT 1`)
        .get();
    const sql = row?.sql ?? '';
    if (sql.includes("'fb2'")) {
        return;
    }
    db.exec(`
    CREATE TABLE IF NOT EXISTS books_v2 (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      author TEXT NULL,
      format TEXT NOT NULL CHECK(format IN ('pdf', 'epub', 'fb2')),
      file_path TEXT NULL,
      created_at INTEGER NOT NULL
    );

    INSERT INTO books_v2 (id, user_id, title, author, format, file_path, created_at)
    SELECT id, user_id, title, author, format, file_path, created_at
    FROM books;

    DROP TABLE books;
    ALTER TABLE books_v2 RENAME TO books;

    CREATE INDEX IF NOT EXISTS idx_books_user_created_at ON books(user_id, created_at DESC);
  `);
}
function runMigrations(db) {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      author TEXT NULL,
      format TEXT NOT NULL CHECK(format IN ('pdf', 'epub', 'fb2')),
      file_path TEXT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reader_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      theme TEXT NOT NULL,
      epub_font_size INTEGER NOT NULL,
      epub_line_height REAL NOT NULL,
      epub_margins TEXT NOT NULL DEFAULT 'medium',
      epub_font_family TEXT NOT NULL DEFAULT 'serif',
      pdf_background TEXT NOT NULL DEFAULT 'light',
      pdf_zoom_preset TEXT NOT NULL DEFAULT 'fitWidth',
      dyslexia_friendly_mode INTEGER NOT NULL DEFAULT 0,
      high_contrast_mode INTEGER NOT NULL DEFAULT 0,
      text_size_preset TEXT NOT NULL DEFAULT 'normal',
      reduce_motion INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reading_stats (
      book_id TEXT PRIMARY KEY,
      total_reading_time_sec INTEGER NOT NULL DEFAULT 0,
      last_opened_at INTEGER NULL,
      open_count INTEGER NOT NULL DEFAULT 0,
      last_format TEXT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_books_user_created_at ON books(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reading_stats_last_opened_at ON reading_stats(last_opened_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reading_stats_updated_at ON reading_stats(updated_at DESC);
  `);
    if (!hasColumn(db, 'reader_settings', 'epub_margins')) {
        db.exec("ALTER TABLE reader_settings ADD COLUMN epub_margins TEXT NOT NULL DEFAULT 'medium';");
    }
    if (!hasColumn(db, 'reader_settings', 'epub_font_family')) {
        db.exec("ALTER TABLE reader_settings ADD COLUMN epub_font_family TEXT NOT NULL DEFAULT 'serif';");
    }
    if (!hasColumn(db, 'reader_settings', 'pdf_background')) {
        db.exec("ALTER TABLE reader_settings ADD COLUMN pdf_background TEXT NOT NULL DEFAULT 'light';");
    }
    if (!hasColumn(db, 'reader_settings', 'pdf_zoom_preset')) {
        db.exec("ALTER TABLE reader_settings ADD COLUMN pdf_zoom_preset TEXT NOT NULL DEFAULT 'fitWidth';");
    }
    if (!hasColumn(db, 'reader_settings', 'dyslexia_friendly_mode')) {
        db.exec("ALTER TABLE reader_settings ADD COLUMN dyslexia_friendly_mode INTEGER NOT NULL DEFAULT 0;");
    }
    if (!hasColumn(db, 'reader_settings', 'high_contrast_mode')) {
        db.exec("ALTER TABLE reader_settings ADD COLUMN high_contrast_mode INTEGER NOT NULL DEFAULT 0;");
    }
    if (!hasColumn(db, 'reader_settings', 'text_size_preset')) {
        db.exec("ALTER TABLE reader_settings ADD COLUMN text_size_preset TEXT NOT NULL DEFAULT 'normal';");
    }
    if (!hasColumn(db, 'reader_settings', 'reduce_motion')) {
        db.exec("ALTER TABLE reader_settings ADD COLUMN reduce_motion INTEGER NOT NULL DEFAULT 0;");
    }
    ensureBooksFormatSchema(db);
}
function ensureLocalLibraryIdentity(db) {
    const existing = db.prepare('SELECT id FROM users WHERE id = ? LIMIT 1').get(exports.LOCAL_DB_ID);
    if (!existing) {
        db.prepare(`INSERT INTO users (id, email, password_hash, display_name, created_at)
       VALUES (?, ?, ?, ?, ?)`).run(exports.LOCAL_DB_ID, 'desktop@local', 'single-user-mode', 'Desktop Library', Date.now());
    }
    const localBookCount = db
        .prepare('SELECT COUNT(*) AS count FROM books WHERE user_id = ?')
        .get(exports.LOCAL_DB_ID);
    if (localBookCount.count > 0) {
        return;
    }
    const legacyUserIds = db
        .prepare(`SELECT DISTINCT user_id
       FROM books
       WHERE user_id != ?
       ORDER BY user_id ASC`)
        .all(exports.LOCAL_DB_ID);
    if (legacyUserIds.length === 1) {
        db.prepare('UPDATE books SET user_id = ? WHERE user_id = ?').run(exports.LOCAL_DB_ID, legacyUserIds[0].user_id);
    }
}
function getDatabase(userDataPath) {
    if (dbInstance) {
        return dbInstance;
    }
    node_fs_1.default.mkdirSync(userDataPath, { recursive: true });
    const dbPath = node_path_1.default.join(userDataPath, 'auth.sqlite');
    dbInstance = new better_sqlite3_1.default(dbPath);
    runMigrations(dbInstance);
    ensureLocalLibraryIdentity(dbInstance);
    return dbInstance;
}
