"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSessionUserId = resolveSessionUserId;
exports.signUp = signUp;
exports.signIn = signIn;
exports.getCurrentUser = getCurrentUser;
exports.signOut = signOut;
const node_crypto_1 = require("node:crypto");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function toUser(row) {
    return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        createdAt: row.created_at
    };
}
function cleanupExpiredSessions(db, now) {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
}
function resolveSessionUserId(db, tokenInput) {
    const token = tokenInput?.trim();
    if (!token) {
        return { ok: false, error: 'Missing session token.' };
    }
    const now = Date.now();
    cleanupExpiredSessions(db, now);
    const sessionRow = db
        .prepare('SELECT user_id, expires_at FROM sessions WHERE token = ? LIMIT 1')
        .get(token);
    if (!sessionRow || sessionRow.expires_at <= now) {
        if (sessionRow) {
            db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
        }
        return { ok: false, error: 'Session is invalid or expired.' };
    }
    return { ok: true, userId: sessionRow.user_id };
}
function validateSignUpInput(payload) {
    const email = normalizeEmail(payload.email);
    const displayName = payload.displayName.trim();
    if (!EMAIL_RE.test(email)) {
        return 'Please enter a valid email.';
    }
    if (displayName.length === 0) {
        return 'Display name is required.';
    }
    if (payload.password.length < MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    return null;
}
function validateSignInInput(payload) {
    const email = normalizeEmail(payload.email);
    if (!EMAIL_RE.test(email)) {
        return 'Please enter a valid email.';
    }
    if (payload.password.length < MIN_PASSWORD_LENGTH) {
        return 'Invalid credentials.';
    }
    return null;
}
function createSession(db, userId, now) {
    const token = (0, node_crypto_1.randomUUID)();
    const expiresAt = now + SESSION_TTL_MS;
    db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(token, userId, now, expiresAt);
    return token;
}
async function signUp(db, payload) {
    const validationError = validateSignUpInput(payload);
    if (validationError) {
        return { ok: false, error: validationError };
    }
    const now = Date.now();
    const id = (0, node_crypto_1.randomUUID)();
    const email = normalizeEmail(payload.email);
    const displayName = payload.displayName.trim();
    const passwordHash = await bcryptjs_1.default.hash(payload.password, 12);
    try {
        db.prepare('INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)').run(id, email, passwordHash, displayName, now);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('UNIQUE constraint failed: users.email')) {
            return { ok: false, error: 'An account with this email already exists.' };
        }
        return { ok: false, error: 'Failed to create account.' };
    }
    const token = createSession(db, id, now);
    return {
        ok: true,
        token,
        user: {
            id,
            email,
            displayName,
            createdAt: now
        }
    };
}
async function signIn(db, payload) {
    const validationError = validateSignInInput(payload);
    if (validationError) {
        return { ok: false, error: validationError };
    }
    const email = normalizeEmail(payload.email);
    const userRow = db
        .prepare('SELECT id, email, display_name, created_at, password_hash FROM users WHERE email = ? LIMIT 1')
        .get(email);
    if (!userRow) {
        return { ok: false, error: 'Invalid credentials.' };
    }
    const passwordOk = await bcryptjs_1.default.compare(payload.password, userRow.password_hash);
    if (!passwordOk) {
        return { ok: false, error: 'Invalid credentials.' };
    }
    const now = Date.now();
    const token = createSession(db, userRow.id, now);
    return {
        ok: true,
        token,
        user: toUser(userRow)
    };
}
function getCurrentUser(db, payload) {
    const token = payload.token?.trim();
    const session = resolveSessionUserId(db, token);
    if (!session.ok) {
        return session;
    }
    const sessionRow = db
        .prepare(`SELECT
         users.id AS user_id,
         users.email,
         users.display_name,
         users.created_at AS user_created_at,
         sessions.expires_at
       FROM sessions
       INNER JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?
       LIMIT 1`)
        .get(token);
    if (!sessionRow) {
        return { ok: false, error: 'Session is invalid or expired.' };
    }
    return {
        ok: true,
        user: {
            id: sessionRow.user_id,
            email: sessionRow.email,
            displayName: sessionRow.display_name,
            createdAt: sessionRow.user_created_at
        }
    };
}
function signOut(db, payload) {
    const token = payload.token?.trim();
    if (!token) {
        return { ok: false, error: 'Missing session token.' };
    }
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return { ok: true };
}
