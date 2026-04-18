"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReaderSettings = getReaderSettings;
exports.updateReaderSettings = updateReaderSettings;
const ipc_1 = require("../shared/ipc");
const READER_THEMES = ['light', 'sepia', 'dark'];
const EPUB_MARGIN_SIZES = ['small', 'medium', 'large'];
const EPUB_FONT_FAMILIES = ['serif', 'sans', 'georgia', 'openDyslexic'];
const PDF_ZOOM_PRESETS = ['fitWidth', 'fitPage', 'actualSize'];
const TEXT_SIZE_PRESETS = ['normal', 'large', 'extraLarge'];
function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function roundLineHeight(value) {
    return Math.round(value * 10) / 10;
}
function isValidChoice(value, choices) {
    return typeof value === 'string' && choices.includes(value);
}
function toReaderSettings(row) {
    return {
        theme: row.theme,
        epubFontSize: row.epub_font_size,
        epubLineHeight: row.epub_line_height,
        epubMargins: row.epub_margins,
        epubFontFamily: row.epub_font_family,
        pdfBackground: row.pdf_background,
        pdfZoomPreset: row.pdf_zoom_preset,
        dyslexiaFriendlyMode: row.dyslexia_friendly_mode === 1,
        highContrastMode: row.high_contrast_mode === 1,
        textSizePreset: row.text_size_preset,
        reduceMotion: row.reduce_motion === 1
    };
}
function sanitizePatch(patch) {
    const nextPatch = {};
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
    if (patch.dyslexiaFriendlyMode !== undefined) {
        if (typeof patch.dyslexiaFriendlyMode !== 'boolean') {
            throw new Error('Dyslexia friendly mode must be a boolean.');
        }
        nextPatch.dyslexiaFriendlyMode = patch.dyslexiaFriendlyMode;
    }
    if (patch.highContrastMode !== undefined) {
        if (typeof patch.highContrastMode !== 'boolean') {
            throw new Error('High contrast mode must be a boolean.');
        }
        nextPatch.highContrastMode = patch.highContrastMode;
    }
    if (patch.textSizePreset !== undefined) {
        if (!isValidChoice(patch.textSizePreset, TEXT_SIZE_PRESETS)) {
            throw new Error('Text size preset must be one of: normal, large, extraLarge.');
        }
        nextPatch.textSizePreset = patch.textSizePreset;
    }
    if (patch.reduceMotion !== undefined) {
        if (typeof patch.reduceMotion !== 'boolean') {
            throw new Error('Reduce motion must be a boolean.');
        }
        nextPatch.reduceMotion = patch.reduceMotion;
    }
    return nextPatch;
}
function readReaderSettingsRow(db, userId) {
    return db
        .prepare(`SELECT user_id, theme, epub_font_size, epub_line_height, epub_margins, epub_font_family, pdf_background, pdf_zoom_preset, updated_at
             , dyslexia_friendly_mode, high_contrast_mode, text_size_preset, reduce_motion
       FROM reader_settings
       WHERE user_id = ?
       LIMIT 1`)
        .get(userId);
}
function insertDefaultReaderSettings(db, userId) {
    const now = Date.now();
    db.prepare(`INSERT INTO reader_settings (
      user_id,
      theme,
      epub_font_size,
      epub_line_height,
      epub_margins,
      epub_font_family,
      pdf_background,
      pdf_zoom_preset,
      dyslexia_friendly_mode,
      high_contrast_mode,
      text_size_preset,
      reduce_motion,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO NOTHING`).run(userId, ipc_1.READER_SETTINGS_DEFAULTS.theme, ipc_1.READER_SETTINGS_DEFAULTS.epubFontSize, ipc_1.READER_SETTINGS_DEFAULTS.epubLineHeight, ipc_1.READER_SETTINGS_DEFAULTS.epubMargins, ipc_1.READER_SETTINGS_DEFAULTS.epubFontFamily, ipc_1.READER_SETTINGS_DEFAULTS.pdfBackground, ipc_1.READER_SETTINGS_DEFAULTS.pdfZoomPreset, ipc_1.READER_SETTINGS_DEFAULTS.dyslexiaFriendlyMode ? 1 : 0, ipc_1.READER_SETTINGS_DEFAULTS.highContrastMode ? 1 : 0, ipc_1.READER_SETTINGS_DEFAULTS.textSizePreset, ipc_1.READER_SETTINGS_DEFAULTS.reduceMotion ? 1 : 0, now);
    return (readReaderSettingsRow(db, userId) ?? {
        user_id: userId,
        theme: ipc_1.READER_SETTINGS_DEFAULTS.theme,
        epub_font_size: ipc_1.READER_SETTINGS_DEFAULTS.epubFontSize,
        epub_line_height: ipc_1.READER_SETTINGS_DEFAULTS.epubLineHeight,
        epub_margins: ipc_1.READER_SETTINGS_DEFAULTS.epubMargins,
        epub_font_family: ipc_1.READER_SETTINGS_DEFAULTS.epubFontFamily,
        pdf_background: ipc_1.READER_SETTINGS_DEFAULTS.pdfBackground,
        pdf_zoom_preset: ipc_1.READER_SETTINGS_DEFAULTS.pdfZoomPreset,
        dyslexia_friendly_mode: ipc_1.READER_SETTINGS_DEFAULTS.dyslexiaFriendlyMode ? 1 : 0,
        high_contrast_mode: ipc_1.READER_SETTINGS_DEFAULTS.highContrastMode ? 1 : 0,
        text_size_preset: ipc_1.READER_SETTINGS_DEFAULTS.textSizePreset,
        reduce_motion: ipc_1.READER_SETTINGS_DEFAULTS.reduceMotion ? 1 : 0,
        updated_at: now
    });
}
function getReaderSettings(db, userId) {
    const safeUserId = userId.trim();
    if (!safeUserId) {
        return ipc_1.READER_SETTINGS_DEFAULTS;
    }
    const existing = readReaderSettingsRow(db, safeUserId);
    return toReaderSettings(existing ?? insertDefaultReaderSettings(db, safeUserId));
}
function updateReaderSettings(db, userId, patch) {
    const safeUserId = userId.trim();
    if (!safeUserId) {
        return { ok: false, error: 'User not found.' };
    }
    try {
        const sanitizedPatch = sanitizePatch(patch);
        const current = getReaderSettings(db, safeUserId);
        const next = {
            theme: sanitizedPatch.theme ?? current.theme,
            epubFontSize: sanitizedPatch.epubFontSize ?? current.epubFontSize,
            epubLineHeight: sanitizedPatch.epubLineHeight ?? current.epubLineHeight,
            epubMargins: sanitizedPatch.epubMargins ?? current.epubMargins,
            epubFontFamily: sanitizedPatch.epubFontFamily ?? current.epubFontFamily,
            pdfBackground: sanitizedPatch.pdfBackground ?? current.pdfBackground,
            pdfZoomPreset: sanitizedPatch.pdfZoomPreset ?? current.pdfZoomPreset,
            dyslexiaFriendlyMode: sanitizedPatch.dyslexiaFriendlyMode ?? current.dyslexiaFriendlyMode,
            highContrastMode: sanitizedPatch.highContrastMode ?? current.highContrastMode,
            textSizePreset: sanitizedPatch.textSizePreset ?? current.textSizePreset,
            reduceMotion: sanitizedPatch.reduceMotion ?? current.reduceMotion
        };
        db.prepare(`INSERT INTO reader_settings (
        user_id,
        theme,
        epub_font_size,
        epub_line_height,
        epub_margins,
        epub_font_family,
        pdf_background,
        pdf_zoom_preset,
        dyslexia_friendly_mode,
        high_contrast_mode,
        text_size_preset,
        reduce_motion,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        theme = excluded.theme,
        epub_font_size = excluded.epub_font_size,
        epub_line_height = excluded.epub_line_height,
        epub_margins = excluded.epub_margins,
        epub_font_family = excluded.epub_font_family,
        pdf_background = excluded.pdf_background,
        pdf_zoom_preset = excluded.pdf_zoom_preset,
        dyslexia_friendly_mode = excluded.dyslexia_friendly_mode,
        high_contrast_mode = excluded.high_contrast_mode,
        text_size_preset = excluded.text_size_preset,
        reduce_motion = excluded.reduce_motion,
        updated_at = excluded.updated_at`).run(safeUserId, next.theme, next.epubFontSize, next.epubLineHeight, next.epubMargins, next.epubFontFamily, next.pdfBackground, next.pdfZoomPreset, next.dyslexiaFriendlyMode ? 1 : 0, next.highContrastMode ? 1 : 0, next.textSizePreset, next.reduceMotion ? 1 : 0, Date.now());
        return { ok: true, settings: next };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Failed to update reader settings.'
        };
    }
}
