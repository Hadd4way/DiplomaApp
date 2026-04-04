"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.READER_SETTINGS_DEFAULTS = void 0;
exports.getReaderSettings = getReaderSettings;
exports.updateReaderSettings = updateReaderSettings;
exports.READER_SETTINGS_DEFAULTS = {
    theme: 'light',
    epubFontSize: 100,
    epubLineHeight: 1.6
};
const READER_THEMES = ['light', 'sepia', 'dark'];
function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function roundLineHeight(value) {
    return Math.round(value * 10) / 10;
}
function toReaderSettings(row) {
    return {
        theme: row.theme,
        epubFontSize: row.epub_font_size,
        epubLineHeight: row.epub_line_height
    };
}
function isValidTheme(value) {
    return typeof value === 'string' && READER_THEMES.includes(value);
}
function sanitizePatch(patch) {
    const nextPatch = {};
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
function readReaderSettingsRow(db, userId) {
    return db
        .prepare(`SELECT user_id, theme, epub_font_size, epub_line_height, updated_at
       FROM reader_settings
       WHERE user_id = ?
       LIMIT 1`)
        .get(userId);
}
function insertDefaultReaderSettings(db, userId) {
    const now = Date.now();
    db.prepare(`INSERT INTO reader_settings (user_id, theme, epub_font_size, epub_line_height, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO NOTHING`).run(userId, exports.READER_SETTINGS_DEFAULTS.theme, exports.READER_SETTINGS_DEFAULTS.epubFontSize, exports.READER_SETTINGS_DEFAULTS.epubLineHeight, now);
    return (readReaderSettingsRow(db, userId) ?? {
        user_id: userId,
        theme: exports.READER_SETTINGS_DEFAULTS.theme,
        epub_font_size: exports.READER_SETTINGS_DEFAULTS.epubFontSize,
        epub_line_height: exports.READER_SETTINGS_DEFAULTS.epubLineHeight,
        updated_at: now
    });
}
function getReaderSettings(db, userId) {
    const safeUserId = userId.trim();
    if (!safeUserId) {
        return exports.READER_SETTINGS_DEFAULTS;
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
            epubLineHeight: sanitizedPatch.epubLineHeight ?? current.epubLineHeight
        };
        db.prepare(`INSERT INTO reader_settings (user_id, theme, epub_font_size, epub_line_height, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         theme = excluded.theme,
         epub_font_size = excluded.epub_font_size,
         epub_line_height = excluded.epub_line_height,
         updated_at = excluded.updated_at`).run(safeUserId, next.theme, next.epubFontSize, next.epubLineHeight, Date.now());
        return { ok: true, settings: next };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Failed to update reader settings.'
        };
    }
}
