import type Database from 'better-sqlite3';
import type {
  EpubFontFamily,
  EpubMarginSize,
  PdfZoomPreset,
  ReaderSettings,
  ReaderSettingsPatch,
  ReaderSettingsUpdateResult,
  ReaderTheme
} from '../shared/ipc';
import { READER_SETTINGS_DEFAULTS } from '../shared/ipc';

type ReaderSettingsRow = {
  user_id: string;
  theme: ReaderTheme;
  epub_font_size: number;
  epub_line_height: number;
  epub_margins: EpubMarginSize;
  epub_font_family: EpubFontFamily;
  pdf_background: ReaderTheme;
  pdf_zoom_preset: PdfZoomPreset;
  updated_at: number;
};

const READER_THEMES: ReaderTheme[] = ['light', 'sepia', 'dark'];
const EPUB_MARGIN_SIZES: EpubMarginSize[] = ['small', 'medium', 'large'];
const EPUB_FONT_FAMILIES: EpubFontFamily[] = ['serif', 'sans', 'georgia', 'openDyslexic'];
const PDF_ZOOM_PRESETS: PdfZoomPreset[] = ['fitWidth', 'fitPage', 'actualSize'];

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundLineHeight(value: number): number {
  return Math.round(value * 10) / 10;
}

function isValidChoice<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === 'string' && choices.includes(value as T);
}

function toReaderSettings(row: ReaderSettingsRow): ReaderSettings {
  return {
    theme: row.theme,
    epubFontSize: row.epub_font_size,
    epubLineHeight: row.epub_line_height,
    epubMargins: row.epub_margins,
    epubFontFamily: row.epub_font_family,
    pdfBackground: row.pdf_background,
    pdfZoomPreset: row.pdf_zoom_preset
  };
}

function sanitizePatch(patch: ReaderSettingsPatch): ReaderSettingsPatch {
  const nextPatch: ReaderSettingsPatch = {};

  if (patch.theme !== undefined) {
    if (!isValidChoice(patch.theme, READER_THEMES)) {
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

  if (patch.epubMargins !== undefined) {
    if (!isValidChoice(patch.epubMargins, EPUB_MARGIN_SIZES)) {
      throw new Error('EPUB margins must be one of: small, medium, large.');
    }
    nextPatch.epubMargins = patch.epubMargins;
  }

  if (patch.epubFontFamily !== undefined) {
    if (!isValidChoice(patch.epubFontFamily, EPUB_FONT_FAMILIES)) {
      throw new Error('EPUB font family must be one of: serif, sans, georgia, openDyslexic.');
    }
    nextPatch.epubFontFamily = patch.epubFontFamily;
  }

  if (patch.pdfBackground !== undefined) {
    if (!isValidChoice(patch.pdfBackground, READER_THEMES)) {
      throw new Error('PDF background must be one of: light, sepia, dark.');
    }
    nextPatch.pdfBackground = patch.pdfBackground;
  }

  if (patch.pdfZoomPreset !== undefined) {
    if (!isValidChoice(patch.pdfZoomPreset, PDF_ZOOM_PRESETS)) {
      throw new Error('PDF zoom preset must be one of: fitWidth, fitPage, actualSize.');
    }
    nextPatch.pdfZoomPreset = patch.pdfZoomPreset;
  }

  return nextPatch;
}

function readReaderSettingsRow(db: Database.Database, userId: string): ReaderSettingsRow | undefined {
  return db
    .prepare(
      `SELECT user_id, theme, epub_font_size, epub_line_height, epub_margins, epub_font_family, pdf_background, pdf_zoom_preset, updated_at
       FROM reader_settings
       WHERE user_id = ?
       LIMIT 1`
    )
    .get(userId) as ReaderSettingsRow | undefined;
}

function insertDefaultReaderSettings(db: Database.Database, userId: string): ReaderSettingsRow {
  const now = Date.now();
  db.prepare(
    `INSERT INTO reader_settings (
      user_id,
      theme,
      epub_font_size,
      epub_line_height,
      epub_margins,
      epub_font_family,
      pdf_background,
      pdf_zoom_preset,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO NOTHING`
  ).run(
    userId,
    READER_SETTINGS_DEFAULTS.theme,
    READER_SETTINGS_DEFAULTS.epubFontSize,
    READER_SETTINGS_DEFAULTS.epubLineHeight,
    READER_SETTINGS_DEFAULTS.epubMargins,
    READER_SETTINGS_DEFAULTS.epubFontFamily,
    READER_SETTINGS_DEFAULTS.pdfBackground,
    READER_SETTINGS_DEFAULTS.pdfZoomPreset,
    now
  );

  return (
    readReaderSettingsRow(db, userId) ?? {
      user_id: userId,
      theme: READER_SETTINGS_DEFAULTS.theme,
      epub_font_size: READER_SETTINGS_DEFAULTS.epubFontSize,
      epub_line_height: READER_SETTINGS_DEFAULTS.epubLineHeight,
      epub_margins: READER_SETTINGS_DEFAULTS.epubMargins,
      epub_font_family: READER_SETTINGS_DEFAULTS.epubFontFamily,
      pdf_background: READER_SETTINGS_DEFAULTS.pdfBackground,
      pdf_zoom_preset: READER_SETTINGS_DEFAULTS.pdfZoomPreset,
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
      epubLineHeight: sanitizedPatch.epubLineHeight ?? current.epubLineHeight,
      epubMargins: sanitizedPatch.epubMargins ?? current.epubMargins,
      epubFontFamily: sanitizedPatch.epubFontFamily ?? current.epubFontFamily,
      pdfBackground: sanitizedPatch.pdfBackground ?? current.pdfBackground,
      pdfZoomPreset: sanitizedPatch.pdfZoomPreset ?? current.pdfZoomPreset
    };

    db.prepare(
      `INSERT INTO reader_settings (
        user_id,
        theme,
        epub_font_size,
        epub_line_height,
        epub_margins,
        epub_font_family,
        pdf_background,
        pdf_zoom_preset,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        theme = excluded.theme,
        epub_font_size = excluded.epub_font_size,
        epub_line_height = excluded.epub_line_height,
        epub_margins = excluded.epub_margins,
        epub_font_family = excluded.epub_font_family,
        pdf_background = excluded.pdf_background,
        pdf_zoom_preset = excluded.pdf_zoom_preset,
        updated_at = excluded.updated_at`
    ).run(
      safeUserId,
      next.theme,
      next.epubFontSize,
      next.epubLineHeight,
      next.epubMargins,
      next.epubFontFamily,
      next.pdfBackground,
      next.pdfZoomPreset,
      Date.now()
    );

    return { ok: true, settings: next };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to update reader settings.'
    };
  }
}
