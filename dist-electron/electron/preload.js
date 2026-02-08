"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const ipc_1 = require("../shared/ipc");
const api = {
    ping: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.ping),
    auth: {
        signUp: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.authSignUp, payload),
        signIn: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.authSignIn, payload),
        getCurrentUser: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.authGetCurrentUser, payload),
        signOut: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.authSignOut, payload)
    },
    books: {
        list: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksList, payload),
        addSample: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksAddSample, payload),
        import: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksImport, payload),
        reveal: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksReveal, payload),
        delete: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksDelete, payload),
        getPdfData: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksGetPdfData, payload)
    }
};
electron_1.contextBridge.exposeInMainWorld('api', api);
