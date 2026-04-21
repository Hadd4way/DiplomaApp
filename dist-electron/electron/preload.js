"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const ipc_1 = require("../shared/ipc");
const api = {
    ping: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.ping),
    discover: {
        search: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.discoverSearch, payload),
        download: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.discoverDownload, payload),
        onDownloadProgress: (listener) => {
            const wrappedListener = (_event, payload) => {
                listener(payload);
            };
            electron_1.ipcRenderer.on(ipc_1.IPC_CHANNELS.discoverDownloadProgress, wrappedListener);
            return () => {
                electron_1.ipcRenderer.removeListener(ipc_1.IPC_CHANNELS.discoverDownloadProgress, wrappedListener);
            };
        }
    },
    recommendations: {
        getHome: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.recommendationsHome),
        getForBook: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.recommendationsForBook, payload)
    },
    wishlist: {
        list: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.wishlistList),
        save: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.wishlistSave, payload),
        remove: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.wishlistRemove, payload),
        update: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.wishlistUpdate, payload)
    },
    books: {
        list: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksList),
        addSample: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksAddSample),
        import: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksImport),
        reveal: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksReveal, payload),
        delete: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksDelete, payload),
        getPdfData: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksGetPdfData, payload),
        getEpubData: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksGetEpubData, payload),
        getFb2Data: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksGetFb2Data, payload),
        getTxtData: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.booksGetTxtData, payload)
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
        insertRaw: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.highlightsInsertRaw, payload),
        updateNote: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.highlightsUpdateNote, payload)
    },
    epubHighlights: {
        list: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.epubHighlightsList, payload),
        create: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.epubHighlightsCreate, payload)
    },
    bookmarks: {
        list: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.bookmarksList, payload),
        toggle: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.bookmarksToggle, payload),
        remove: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.bookmarksRemove, payload)
    },
    epubBookmarks: {
        list: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.epubBookmarksList, payload),
        toggle: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.epubBookmarksToggle, payload)
    },
    export: {
        getBookData: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.exportGetBookData, payload),
        saveFile: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.exportSaveFile, payload)
    },
    epubProgress: {
        get: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.epubProgressGet, payload),
        set: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.epubProgressSet, payload)
    },
    flowProgress: {
        get: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.flowProgressGet, payload),
        set: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.flowProgressSet, payload)
    },
    readerSettings: {
        get: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.readerSettingsGet, payload),
        update: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.readerSettingsUpdate, payload)
    },
    stats: {
        markOpened: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.statsMarkOpened, payload),
        getRecentBooks: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.statsGetRecentBooks)
    },
    aiSummaries: {
        save: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.aiSummariesSave, payload),
        list: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.aiSummariesList),
        get: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.aiSummariesGet, payload),
        delete: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.aiSummariesDelete, payload)
    },
    getLastPage: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.progressGetLastPage, payload),
    setLastPage: (payload) => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.progressSetLastPage, payload)
};
electron_1.contextBridge.exposeInMainWorld('api', api);
