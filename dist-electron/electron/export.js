"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBookExportData = getBookExportData;
exports.saveExportFile = saveExportFile;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
function toBook(row) {
    return {
        id: row.id,
        title: row.title,
        author: row.author,
        format: row.format,
        filePath: row.file_path,
        createdAt: row.created_at
    };
}
function sanitizeFilename(value) {
    const trimmed = value.trim();
    const fallback = 'book-export';
    const safe = (trimmed || fallback).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\s+/g, ' ');
    return safe.slice(0, 120).trim() || fallback;
}
function getBookExportData(authDb, readerDb, userId, payload) {
    const bookId = payload.bookId?.trim();
    if (!bookId) {
        return { ok: false, error: 'Book not found' };
    }
    const row = authDb
        .prepare(`SELECT id, user_id, title, author, format, file_path, created_at
       FROM books
       WHERE id = ? AND user_id = ?
       LIMIT 1`)
        .get(bookId, userId);
    if (!row) {
        return { ok: false, error: 'Book not found' };
    }
    return {
        ok: true,
        data: {
            book: toBook(row),
            notes: readerDb.listNotesByBookForExport(userId, bookId),
            highlights: readerDb.listHighlightsByBook(userId, bookId)
        }
    };
}
async function saveExportFile(payload, ownerWindow) {
    const ext = payload.ext === 'json' ? 'json' : 'md';
    const content = typeof payload.content === 'string' ? payload.content : '';
    const baseName = sanitizeFilename(payload.suggestedName || 'book-export');
    const finalName = baseName.toLowerCase().endsWith(`.${ext}`) ? baseName : `${baseName}.${ext}`;
    const saveResult = ownerWindow
        ? await electron_1.dialog.showSaveDialog(ownerWindow, {
            title: 'Save export',
            defaultPath: finalName,
            filters: [{ name: ext === 'md' ? 'Markdown' : 'JSON', extensions: [ext] }]
        })
        : await electron_1.dialog.showSaveDialog({
            title: 'Save export',
            defaultPath: finalName,
            filters: [{ name: ext === 'md' ? 'Markdown' : 'JSON', extensions: [ext] }]
        });
    if (saveResult.canceled || !saveResult.filePath) {
        return { ok: false, cancelled: true };
    }
    try {
        await promises_1.default.mkdir(node_path_1.default.dirname(saveResult.filePath), { recursive: true });
        await promises_1.default.writeFile(saveResult.filePath, content, 'utf8');
        return { ok: true, path: saveResult.filePath };
    }
    catch {
        return { ok: false, error: 'Failed to save export file.' };
    }
}
