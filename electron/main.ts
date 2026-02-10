import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import {
  type BooksAddSampleRequest,
  type BooksDeleteRequest,
  type BooksGetPdfDataRequest,
  type BooksImportRequest,
  type BooksRevealRequest,
  type BooksListRequest,
  IPC_CHANNELS,
  type GetCurrentUserRequest,
  type NotesCreateRequest,
  type NotesDeleteRequest,
  type NotesListRequest,
  type PingResponse,
  type ProgressGetLastPageRequest,
  type ProgressSetLastPageRequest,
  type SignInRequest,
  type SignOutRequest,
  type SignUpRequest
} from '../shared/ipc';
import { getDatabase } from './db';
import { getCurrentUser, signIn, signOut, signUp } from './auth';
import { addSampleBook, deleteBook, getPdfData, importBook, listBooks, revealBook } from './books';
import { createNote, deleteNote, listNotes } from './notes';
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

  ipcMain.handle(IPC_CHANNELS.ping, (): PingResponse => ({
    ok: true,
    message: 'pong',
    versions: {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome
    }
  }));

  ipcMain.handle(IPC_CHANNELS.authSignUp, (_event, payload: SignUpRequest) => signUp(db, payload));
  ipcMain.handle(IPC_CHANNELS.authSignIn, (_event, payload: SignInRequest) => signIn(db, payload));
  ipcMain.handle(IPC_CHANNELS.authGetCurrentUser, (_event, payload: GetCurrentUserRequest) =>
    getCurrentUser(db, payload)
  );
  ipcMain.handle(IPC_CHANNELS.authSignOut, (_event, payload: SignOutRequest) => signOut(db, payload));
  ipcMain.handle(IPC_CHANNELS.booksList, (_event, payload: BooksListRequest) => listBooks(db, payload));
  ipcMain.handle(IPC_CHANNELS.booksAddSample, (_event, payload: BooksAddSampleRequest) =>
    addSampleBook(db, payload)
  );
  ipcMain.handle(IPC_CHANNELS.booksImport, (_event, payload: BooksImportRequest) =>
    importBook(db, payload, userDataPath, mainWindow)
  );
  ipcMain.handle(IPC_CHANNELS.booksReveal, (_event, payload: BooksRevealRequest) =>
    revealBook(db, payload, userDataPath)
  );
  ipcMain.handle(IPC_CHANNELS.booksDelete, (_event, payload: BooksDeleteRequest) =>
    deleteBook(db, payload, userDataPath)
  );
  ipcMain.handle(IPC_CHANNELS.booksGetPdfData, (_event, payload: BooksGetPdfDataRequest) =>
    getPdfData(db, payload)
  );
  ipcMain.handle(IPC_CHANNELS.notesCreate, (_event, payload: NotesCreateRequest) => createNote(db, progressDb, payload));
  ipcMain.handle(IPC_CHANNELS.notesList, (_event, payload: NotesListRequest) => listNotes(db, progressDb, payload));
  ipcMain.handle(IPC_CHANNELS.notesDelete, (_event, payload: NotesDeleteRequest) => deleteNote(db, progressDb, payload));
  ipcMain.handle(IPC_CHANNELS.progressGetLastPage, (_event, payload: ProgressGetLastPageRequest) =>
    progressDb.getLastPage(payload.userId, payload.bookId)
  );
  ipcMain.handle(IPC_CHANNELS.progressSetLastPage, (_event, payload: ProgressSetLastPageRequest) =>
    progressDb.setLastPage(payload.userId, payload.bookId, payload.lastPage)
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
