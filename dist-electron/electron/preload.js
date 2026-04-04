"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const ipc_1 = require("../shared/ipc");
const api = {
    ping: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.ping),
    books: {
        list: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksList),
        addSample: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksAddSample),
        import: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksImport),
        reveal: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksReveal, payload),
        delete: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksDelete, payload),
        getPdfData: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksGetPdfData, payload),
        getEpubData: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksGetEpubData, payload)
    },
    notes: {
        create: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.notesCreate, payload),
        list: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.notesList, payload),
        delete: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.notesDelete, payload),
        update: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.notesUpdate, payload)
    },
    highlights: {
        list: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.highlightsList, payload),
        createMerged: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.highlightsCreateMerged, payload),
        delete: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.highlightsDelete, payload),
        insertRaw: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.highlightsInsertRaw, payload)
    },
    bookmarks: {
        list: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.bookmarksList, payload),
        toggle: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.bookmarksToggle, payload),
        remove: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.bookmarksRemove, payload)
    },
    export: {
        getBookData: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.exportGetBookData, payload),
        saveFile: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.exportSaveFile, payload)
    },
    epubProgress: {
        get: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.epubProgressGet, payload),
        set: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.epubProgressSet, payload)
    },
    getLastPage: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.progressGetLastPage, payload),
    setLastPage: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.progressSetLastPage, payload)
};
electron_1.contextBridge.exposeInMainWorld('api', api);
