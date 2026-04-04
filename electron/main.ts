import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import {
  type BooksDeleteRequest,
  type BooksGetEpubDataRequest,
  type BooksGetPdfDataRequest,
  type BooksRevealRequest,
  IPC_CHANNELS,
  type NotesCreateRequest,
  type NotesDeleteRequest,
  type NotesListRequest,
  type NotesUpdateRequest,
  type PingResponse,
  type EpubProgressGetRequest,
  type EpubProgressSetRequest,
  type ExportGetBookDataRequest,
  type ExportSaveFileRequest,
  type BookmarksListRequest,
  type BookmarksToggleRequest,
  type BookmarksRemoveRequest,
  type HighlightsCreateMergedRequest,
  type HighlightsDeleteRequest,
  type HighlightsInsertRawRequest,
  type HighlightsListRequest,
  type ProgressGetLastPageRequest,
  type ProgressSetLastPageRequest
} from '../shared/ipc';
import { getDatabase } from './db';
import { addSampleBook, deleteBook, getEpubData, getPdfData, importBook, listBooks, revealBook } from './books';
import { createNote, deleteNote, listNotes, updateNote } from './notes';
import { createMergedHighlight, deleteHighlight, insertRawHighlight, listHighlights } from './highlights';
import { listBookmarks, removeBookmark, toggleBookmark } from './bookmarks';
import { getBookExportData, saveExportFile } from './export';
import { getEpubProgress, setEpubProgress } from './epub-progress';
import { getReaderProgressDb } from './reader-progress-db';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  const db = getDatabase(userDataPath);
  const progressDb = getReaderProgressDb(userDataPath);
  const libraryId = 'local-user';
  progressDb.migrateLegacyUserData(libraryId);

  ipcMain.handle(IPC_CHANNELS.ping, (): PingResponse => ({
    ok: true,
    message: 'pong',
    versions: {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome
    }
  }));

  ipcMain.handle(IPC_CHANNELS.booksList, () => listBooks(db, libraryId));
  ipcMain.handle(IPC_CHANNELS.booksAddSample, () => addSampleBook(db, libraryId));
  ipcMain.handle(IPC_CHANNELS.booksImport, () => importBook(db, libraryId, userDataPath, mainWindow));
  ipcMain.handle(IPC_CHANNELS.booksReveal, (_event, payload: BooksRevealRequest) =>
    revealBook(db, libraryId, payload, userDataPath)
  );
  ipcMain.handle(IPC_CHANNELS.booksDelete, (_event, payload: BooksDeleteRequest) =>
    deleteBook(db, libraryId, payload, userDataPath)
  );
  ipcMain.handle(IPC_CHANNELS.booksGetPdfData, (_event, payload: BooksGetPdfDataRequest) =>
    getPdfData(db, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.booksGetEpubData, (_event, payload: BooksGetEpubDataRequest) =>
    getEpubData(db, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.notesCreate, (_event, payload: NotesCreateRequest) =>
    createNote(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.notesList, (_event, payload: NotesListRequest) =>
    listNotes(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.notesDelete, (_event, payload: NotesDeleteRequest) =>
    deleteNote(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.notesUpdate, (_event, payload: NotesUpdateRequest) =>
    updateNote(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.highlightsList, (_event, payload: HighlightsListRequest) =>
    listHighlights(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.highlightsCreateMerged, (_event, payload: HighlightsCreateMergedRequest) =>
    createMergedHighlight(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.highlightsDelete, (_event, payload: HighlightsDeleteRequest) =>
    deleteHighlight(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.highlightsInsertRaw, (_event, payload: HighlightsInsertRawRequest) =>
    insertRawHighlight(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.bookmarksList, (_event, payload: BookmarksListRequest) =>
    listBookmarks(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.bookmarksToggle, (_event, payload: BookmarksToggleRequest) =>
    toggleBookmark(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.bookmarksRemove, (_event, payload: BookmarksRemoveRequest) =>
    removeBookmark(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.exportGetBookData, (_event, payload: ExportGetBookDataRequest) =>
    getBookExportData(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.exportSaveFile, async (_event, payload: ExportSaveFileRequest) =>
    saveExportFile(payload, mainWindow)
  );
  ipcMain.handle(IPC_CHANNELS.epubProgressGet, (_event, payload: EpubProgressGetRequest) =>
    getEpubProgress(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.epubProgressSet, (_event, payload: EpubProgressSetRequest) =>
    setEpubProgress(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.progressGetLastPage, (_event, payload: ProgressGetLastPageRequest) =>
    progressDb.getLastPage(libraryId, payload.bookId)
  );
  ipcMain.handle(IPC_CHANNELS.progressSetLastPage, (_event, payload: ProgressSetLastPageRequest) =>
    progressDb.setLastPage(libraryId, payload.bookId, payload.lastPage)
  );

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
