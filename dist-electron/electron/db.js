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
      format TEXT NOT NULL CHECK(format IN ('pdf', 'epub')),
      file_path TEXT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reader_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      theme TEXT NOT NULL,
      epub_font_size INTEGER NOT NULL,
      epub_line_height REAL NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_books_user_created_at ON books(user_id, created_at DESC);
  `);
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
