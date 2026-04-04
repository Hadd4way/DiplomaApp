import type Database from 'better-sqlite3';
import type {
  ReaderSettings,
  ReaderSettingsPatch,
  ReaderSettingsUpdateResult
} from '../shared/ipc';

type ReaderSettingsRow = {
  user_id: string;
  theme: ReaderSettings['theme'];
  epub_font_size: number;
  epub_line_height: number;
  updated_at: number;
};

export const READER_SETTINGS_DEFAULTS: ReaderSettings = {
  theme: 'light',
  epubFontSize: 100,
  epubLineHeight: 1.6
};

const READER_THEMES: ReaderSettings['theme'][] = ['light', 'sepia', 'dark'];

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundLineHeight(value: number): number {
  return Math.round(value * 10) / 10;
}

function toReaderSettings(row: ReaderSettingsRow): ReaderSettings {
  return {
    theme: row.theme,
    epubFontSize: row.epub_font_size,
    epubLineHeight: row.epub_line_height
  };
}

function isValidTheme(value: unknown): value is ReaderSettings['theme'] {
  return typeof value === 'string' && READER_THEMES.includes(value as ReaderSettings['theme']);
}

function sanitizePatch(patch: ReaderSettingsPatch): ReaderSettingsPatch {
  const nextPatch: ReaderSettingsPatch = {};

  if (patch.theme !== undefined) {
    if (!isValidTheme(patch.theme)) {
      throw new Error('Theme must be one of: light, sepia, dark.');
    }
    nextPatch.theme = patch.theme;
  }

  if (patch.epubFontSize !== undefined) {
    if (!Number.isFinite(patch.epubFontSize)) {
      throw new Error('EPUB font size must be a number.');
    }
    nextPatch.epubFontSize = Math.round(clampNumber(patch.epubFontSize, 80, 180));
  }

  if (patch.epubLineHeight !== undefined) {
    if (!Number.isFinite(patch.epubLineHeight)) {
      throw new Error('EPUB line height must be a number.');
    }
    nextPatch.epubLineHeight = roundLineHeight(clampNumber(patch.epubLineHeight, 1.2, 2.4));
  }

  return nextPatch;
}

function readReaderSettingsRow(db: Database.Database, userId: string): ReaderSettingsRow | undefined {
  return db
    .prepare(
      `SELECT user_id, theme, epub_font_size, epub_line_height, updated_at
       FROM reader_settings
       WHERE user_id = ?
       LIMIT 1`
    )
    .get(userId) as ReaderSettingsRow | undefined;
}

function insertDefaultReaderSettings(db: Database.Database, userId: string): ReaderSettingsRow {
  const now = Date.now();
  db.prepare(
    `INSERT INTO reader_settings (user_id, theme, epub_font_size, epub_line_height, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO NOTHING`
  ).run(
    userId,
    READER_SETTINGS_DEFAULTS.theme,
    READER_SETTINGS_DEFAULTS.epubFontSize,
    READER_SETTINGS_DEFAULTS.epubLineHeight,
    now
  );

  return (
    readReaderSettingsRow(db, userId) ?? {
      user_id: userId,
      theme: READER_SETTINGS_DEFAULTS.theme,
      epub_font_size: READER_SETTINGS_DEFAULTS.epubFontSize,
      epub_line_height: READER_SETTINGS_DEFAULTS.epubLineHeight,
      updated_at: now
    }
  );
}

export function getReaderSettings(db: Database.Database, userId: string): ReaderSettings {
  const safeUserId = userId.trim();
  if (!safeUserId) {
    return READER_SETTINGS_DEFAULTS;
  }

  const existing = readReaderSettingsRow(db, safeUserId);
  return toReaderSettings(existing ?? insertDefaultReaderSettings(db, safeUserId));
}

export function updateReaderSettings(
  db: Database.Database,
  userId: string,
  patch: ReaderSettingsPatch
): ReaderSettingsUpdateResult {
  const safeUserId = userId.trim();
  if (!safeUserId) {
    return { ok: false, error: 'User not found.' };
  }

  try {
    const sanitizedPatch = sanitizePatch(patch);
    const current = getReaderSettings(db, safeUserId);
    const next: ReaderSettings = {
      theme: sanitizedPatch.theme ?? current.theme,
      epubFontSize: sanitizedPatch.epubFontSize ?? current.epubFontSize,
      epubLineHeight: sanitizedPatch.epubLineHeight ?? current.epubLineHeight
    };

    db.prepare(
      `INSERT INTO reader_settings (user_id, theme, epub_font_size, epub_line_height, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         theme = excluded.theme,
         epub_font_size = excluded.epub_font_size,
         epub_line_height = excluded.epub_line_height,
         updated_at = excluded.updated_at`
    ).run(safeUserId, next.theme, next.epubFontSize, next.epubLineHeight, Date.now());

    return { ok: true, settings: next };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to update reader settings.'
    };
  }
}
