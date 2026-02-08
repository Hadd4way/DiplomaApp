"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const ipc_1 = require("../shared/ipc");
const db_1 = require("./db");
const auth_1 = require("./auth");
const books_1 = require("./books");
let mainWindow = null;
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
    const db = (0, db_1.getDatabase)(electron_1.app.getPath('userData'));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.ping, () => ({
        ok: true,
        message: 'pong',
        versions: {
            electron: process.versions.electron,
            node: process.versions.node,
            chrome: process.versions.chrome
        }
    }));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.authSignUp, (_event, payload) => (0, auth_1.signUp)(db, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.authSignIn, (_event, payload) => (0, auth_1.signIn)(db, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.authGetCurrentUser, (_event, payload) => (0, auth_1.getCurrentUser)(db, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.authSignOut, (_event, payload) => (0, auth_1.signOut)(db, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.booksList, (_event, payload) => (0, books_1.listBooks)(db, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.booksAddSample, (_event, payload) => (0, books_1.addSampleBook)(db, payload));
    electron_1.ipcMain.handle(ipc_1.IPC_CHANNELS.booksImport, (_event, payload) => (0, books_1.importBook)(db, payload, electron_1.app.getPath('userData'), mainWindow));
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
