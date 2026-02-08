import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import type {
  AuthResult,
  GetCurrentUserRequest,
  GetCurrentUserResult,
  SignInRequest,
  SignOutRequest,
  SignOutResult,
  SignUpRequest,
  User
} from '../shared/ipc';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  created_at: number;
  password_hash: string;
};

type SessionUserRow = {
  user_id: string;
  email: string;
  display_name: string;
  user_created_at: number;
  expires_at: number;
};

type SessionRow = {
  user_id: string;
  expires_at: number;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toUser(row: { id: string; email: string; display_name: string; created_at: number }): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at
  };
}

function cleanupExpiredSessions(db: Database.Database, now: number) {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
}

export function resolveSessionUserId(
  db: Database.Database,
  tokenInput: string | undefined
): { ok: true; userId: string } | { ok: false; error: string } {
  const token = tokenInput?.trim();
  if (!token) {
    return { ok: false, error: 'Missing session token.' };
  }

  const now = Date.now();
  cleanupExpiredSessions(db, now);

  const sessionRow = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token = ? LIMIT 1')
    .get(token) as SessionRow | undefined;

  if (!sessionRow || sessionRow.expires_at <= now) {
    if (sessionRow) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    return { ok: false, error: 'Session is invalid or expired.' };
  }

  return { ok: true, userId: sessionRow.user_id };
}

function validateSignUpInput(payload: SignUpRequest): string | null {
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

function validateSignInInput(payload: SignInRequest): string | null {
  const email = normalizeEmail(payload.email);

  if (!EMAIL_RE.test(email)) {
    return 'Please enter a valid email.';
  }

  if (payload.password.length < MIN_PASSWORD_LENGTH) {
    return 'Invalid credentials.';
  }

  return null;
}

function createSession(db: Database.Database, userId: string, now: number): string {
  const token = randomUUID();
  const expiresAt = now + SESSION_TTL_MS;

  db.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, userId, now, expiresAt);

  return token;
}

export async function signUp(db: Database.Database, payload: SignUpRequest): Promise<AuthResult> {
  const validationError = validateSignUpInput(payload);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const now = Date.now();
  const id = randomUUID();
  const email = normalizeEmail(payload.email);
  const displayName = payload.displayName.trim();
  const passwordHash = await bcrypt.hash(payload.password, 12);

  try {
    db.prepare(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, email, passwordHash, displayName, now);
  } catch (error) {
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

export async function signIn(db: Database.Database, payload: SignInRequest): Promise<AuthResult> {
  const validationError = validateSignInInput(payload);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const email = normalizeEmail(payload.email);
  const userRow = db
    .prepare(
      'SELECT id, email, display_name, created_at, password_hash FROM users WHERE email = ? LIMIT 1'
    )
    .get(email) as UserRow | undefined;

  if (!userRow) {
    return { ok: false, error: 'Invalid credentials.' };
  }

  const passwordOk = await bcrypt.compare(payload.password, userRow.password_hash);
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

export function getCurrentUser(
  db: Database.Database,
  payload: GetCurrentUserRequest
): GetCurrentUserResult {
  const token = payload.token?.trim();
  const session = resolveSessionUserId(db, token);
  if (!session.ok) {
    return session;
  }

  const sessionRow = db
    .prepare(
      `SELECT
         users.id AS user_id,
         users.email,
         users.display_name,
         users.created_at AS user_created_at,
         sessions.expires_at
       FROM sessions
       INNER JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?
       LIMIT 1`
    )
    .get(token) as SessionUserRow | undefined;

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

export function signOut(db: Database.Database, payload: SignOutRequest): SignOutResult {
  const token = payload.token?.trim();
  if (!token) {
    return { ok: false, error: 'Missing session token.' };
  }

  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  return { ok: true };
}
