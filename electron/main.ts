import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import {
  type DiscoverDownloadRequest,
  type DiscoverSearchRequest,
  type BooksDeleteRequest,
  type BooksGetEpubDataRequest,
  type BooksGetFb2DataRequest,
  type BooksGetPdfDataRequest,
  type BooksGetTxtDataRequest,
  type BooksRevealRequest,
  type FlowProgressGetRequest,
  type FlowProgressSetRequest,
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
  type EpubBookmarksListRequest,
  type EpubBookmarksToggleRequest,
  type HighlightsCreateMergedRequest,
  type HighlightsDeleteRequest,
  type EpubHighlightsCreateRequest,
  type EpubHighlightsListRequest,
  type HighlightsInsertRawRequest,
  type HighlightsListRequest,
  type HighlightsUpdateNoteRequest,
  type ReaderSettingsGetRequest,
  type ReaderSettingsUpdateRequest,
  type ProgressGetLastPageRequest,
  type ProgressSetLastPageRequest,
  type StatsMarkOpenedRequest
} from '../shared/ipc';
import { getDatabase, LOCAL_DB_ID } from './db';
import { addSampleBook, deleteBook, getEpubData, getFb2Data, getPdfData, getTxtData, importBook, listBooks, revealBook } from './books';
import { downloadDiscoverBook, searchDiscoverBooks } from './discover';
import { createNote, deleteNote, listNotes, updateNote } from './notes';
import {
  createEpubHighlight,
  createMergedHighlight,
  deleteHighlight,
  insertRawHighlight,
  listEpubHighlights,
  listHighlights,
  updateHighlightNote
} from './highlights';
import { listBookmarks, removeBookmark, toggleBookmark } from './bookmarks';
import { listEpubBookmarks, toggleEpubBookmark } from './epub-bookmarks';
import { getBookExportData, saveExportFile } from './export';
import { getEpubProgress, setEpubProgress } from './epub-progress';
import { getFlowProgress, setFlowProgress } from './flow-progress';
import { getReaderProgressDb } from './reader-progress-db';
import { getReaderSettings, updateReaderSettings } from './reader-settings';
import { getRecentBooks, markBookOpened } from './reading-stats';

let mainWindow: BrowserWindow | null = null;

function resolveUserIdFromToken(db: ReturnType<typeof getDatabase>, token: string): string {
  const safeToken = token.trim();
  if (!safeToken) {
    return LOCAL_DB_ID;
  }

  const sessionRow = db
    .prepare(
      `SELECT user_id
       FROM sessions
       WHERE token = ?
       LIMIT 1`
    )
    .get(safeToken) as { user_id: string } | undefined;

  return sessionRow?.user_id ?? LOCAL_DB_ID;
}

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
  const libraryId = LOCAL_DB_ID;
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

  ipcMain.handle(IPC_CHANNELS.discoverSearch, (_event, payload: DiscoverSearchRequest) => searchDiscoverBooks(db, payload));
  ipcMain.handle(IPC_CHANNELS.discoverDownload, (event, payload: DiscoverDownloadRequest) =>
    downloadDiscoverBook(db, libraryId, userDataPath, payload, event.sender)
  );
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
  ipcMain.handle(IPC_CHANNELS.booksGetFb2Data, (_event, payload: BooksGetFb2DataRequest) =>
    getFb2Data(db, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.booksGetTxtData, (_event, payload: BooksGetTxtDataRequest) =>
    getTxtData(db, libraryId, payload)
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
  ipcMain.handle(IPC_CHANNELS.highlightsUpdateNote, (_event, payload: HighlightsUpdateNoteRequest) =>
    updateHighlightNote(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.epubHighlightsList, (_event, payload: EpubHighlightsListRequest) =>
    listEpubHighlights(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.epubHighlightsCreate, (_event, payload: EpubHighlightsCreateRequest) =>
    createEpubHighlight(db, progressDb, libraryId, payload)
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
  ipcMain.handle(IPC_CHANNELS.epubBookmarksList, (_event, payload: EpubBookmarksListRequest) =>
    listEpubBookmarks(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.epubBookmarksToggle, (_event, payload: EpubBookmarksToggleRequest) =>
    toggleEpubBookmark(db, progressDb, libraryId, payload)
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
  ipcMain.handle(IPC_CHANNELS.flowProgressGet, (_event, payload: FlowProgressGetRequest) =>
    getFlowProgress(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.flowProgressSet, (_event, payload: FlowProgressSetRequest) =>
    setFlowProgress(db, progressDb, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.readerSettingsGet, (_event, payload: ReaderSettingsGetRequest) => {
    try {
      const userId = resolveUserIdFromToken(db, payload.token ?? '');
      return { ok: true, settings: getReaderSettings(db, userId) };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to load reader settings.'
      };
    }
  });
  ipcMain.handle(IPC_CHANNELS.readerSettingsUpdate, (_event, payload: ReaderSettingsUpdateRequest) => {
    const userId = resolveUserIdFromToken(db, payload.token ?? '');
    return updateReaderSettings(db, userId, payload.patch ?? {});
  });
  ipcMain.handle(IPC_CHANNELS.progressGetLastPage, (_event, payload: ProgressGetLastPageRequest) =>
    progressDb.getLastPage(libraryId, payload.bookId)
  );
  ipcMain.handle(IPC_CHANNELS.progressSetLastPage, (_event, payload: ProgressSetLastPageRequest) =>
    progressDb.setLastPage(libraryId, payload.bookId, payload.lastPage)
  );
  ipcMain.handle(IPC_CHANNELS.statsMarkOpened, (_event, payload: StatsMarkOpenedRequest) =>
    markBookOpened(db, libraryId, payload)
  );
  ipcMain.handle(IPC_CHANNELS.statsGetRecentBooks, () => getRecentBooks(db, libraryId));

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
