"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const ipc_1 = require("../shared/ipc");
const db_1 = require("./db");
const books_1 = require("./books");
const notes_1 = require("./notes");
const highlights_1 = require("./highlights");
const bookmarks_1 = require("./bookmarks");
const epub_bookmarks_1 = require("./epub-bookmarks");
const export_1 = require("./export");
const epub_progress_1 = require("./epub-progress");
const reader_progress_db_1 = require("./reader-progress-db");
const reader_settings_1 = require("./reader-settings");
const reading_stats_1 = require("./reading-stats");
let mainWindow = null;
function resolveUserIdFromToken(db, token) {
    const safeToken = token.trim();
    if (!safeToken) {
        return db_1.LOCAL_DB_ID;
    }
    const sessionRow = db
        .prepare(`SELECT user_id
       FROM sessions
       WHERE token = ?
       LIMIT 1`)
        .get(safeToken);
    return sessionRow?.user_id ?? db_1.LOCAL_DB_ID;
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
        mainWindow.loadURL(devServerUrl);
    }
    else {
        mainWindow.loadFile(node_path_1.default.join(electron_1.app.getAppPath(), 'dist', 'index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    const userDataPath = electron_1.app.getPath('userData');
    const db = (0, db_1.getDatabase)(userDataPath);
    const progressDb = (0, reader_progress_db_1.getReaderProgressDb)(userDataPath);
    const libraryId = db_1.LOCAL_DB_ID;
    progressDb.migrateLegacyUserData(libraryId);
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.ping, () => ({
        ok: true,
        message: 'pong',
        versions: {
            electron: process.versions.electron,
            node: process.versions.node,
            chrome: process.versions.chrome
        }
    }));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.booksList, () => (0, books_1.listBooks)(db, libraryId));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.booksAddSample, () => (0, books_1.addSampleBook)(db, libraryId));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.booksImport, () => (0, books_1.importBook)(db, libraryId, userDataPath, mainWindow));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.booksReveal, (_event, payload) => (0, books_1.revealBook)(db, libraryId, payload, userDataPath));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.booksDelete, (_event, payload) => (0, books_1.deleteBook)(db, libraryId, payload, userDataPath));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.booksGetPdfData, (_event, payload) => (0, books_1.getPdfData)(db, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.booksGetEpubData, (_event, payload) => (0, books_1.getEpubData)(db, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.notesCreate, (_event, payload) => (0, notes_1.createNote)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.notesList, (_event, payload) => (0, notes_1.listNotes)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.notesDelete, (_event, payload) => (0, notes_1.deleteNote)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.notesUpdate, (_event, payload) => (0, notes_1.updateNote)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.highlightsList, (_event, payload) => (0, highlights_1.listHighlights)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.highlightsCreateMerged, (_event, payload) => (0, highlights_1.createMergedHighlight)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.highlightsDelete, (_event, payload) => (0, highlights_1.deleteHighlight)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.highlightsInsertRaw, (_event, payload) => (0, highlights_1.insertRawHighlight)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.highlightsUpdateNote, (_event, payload) => (0, highlights_1.updateHighlightNote)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.bookmarksList, (_event, payload) => (0, bookmarks_1.listBookmarks)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.bookmarksToggle, (_event, payload) => (0, bookmarks_1.toggleBookmark)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.bookmarksRemove, (_event, payload) => (0, bookmarks_1.removeBookmark)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.epubBookmarksList, (_event, payload) => (0, epub_bookmarks_1.listEpubBookmarks)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.epubBookmarksToggle, (_event, payload) => (0, epub_bookmarks_1.toggleEpubBookmark)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.exportGetBookData, (_event, payload) => (0, export_1.getBookExportData)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.exportSaveFile, async (_event, payload) => (0, export_1.saveExportFile)(payload, mainWindow));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.epubProgressGet, (_event, payload) => (0, epub_progress_1.getEpubProgress)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.epubProgressSet, (_event, payload) => (0, epub_progress_1.setEpubProgress)(db, progressDb, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.readerSettingsGet, (_event, payload) => {
        try {
            const userId = resolveUserIdFromToken(db, payload.token ?? '');
            return { ok: true, settings: (0, reader_settings_1.getReaderSettings)(db, userId) };
        }
        catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Failed to load reader settings.'
            };
        }
    });
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.readerSettingsUpdate, (_event, payload) => {
        const userId = resolveUserIdFromToken(db, payload.token ?? '');
        return (0, reader_settings_1.updateReaderSettings)(db, userId, payload.patch ?? {});
    });
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.progressGetLastPage, (_event, payload) => progressDb.getLastPage(libraryId, payload.bookId));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.progressSetLastPage, (_event, payload) => progressDb.setLastPage(libraryId, payload.bookId, payload.lastPage));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.statsMarkOpened, (_event, payload) => (0, reading_stats_1.markBookOpened)(db, libraryId, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.statsGetRecentBooks, () => (0, reading_stats_1.getRecentBooks)(db, libraryId));
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
