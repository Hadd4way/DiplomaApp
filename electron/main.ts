import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import {
  IPC_CHANNELS,
  type GetCurrentUserRequest,
  type PingResponse,
  type SignInRequest,
  type SignOutRequest,
  type SignUpRequest
} from '../shared/ipc';
import { getDatabase } from './db';
import { getCurrentUser, signIn, signOut, signUp } from './auth';

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
  const db = getDatabase(app.getPath('userData'));

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
