import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type RendererApi } from '../shared/ipc';

const api: RendererApi = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping),
  discover: {
    search: (payload) => ipcRenderer.invoke(IPC_CHANNELS.discoverSearch, payload),
    download: (payload) => ipcRenderer.invoke(IPC_CHANNELS.discoverDownload, payload),
    onDownloadProgress: (listener) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) => {
        listener(payload);
      };

      ipcRenderer.on(IPC_CHANNELS.discoverDownloadProgress, wrappedListener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.discoverDownloadProgress, wrappedListener);
      };
    }
  },
  recommendations: {
    getHome: () => ipcRenderer.invoke(IPC_CHANNELS.recommendationsHome),
    getForBook: (payload) => ipcRenderer.invoke(IPC_CHANNELS.recommendationsForBook, payload)
  },
  wishlist: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.wishlistList),
    save: (payload) => ipcRenderer.invoke(IPC_CHANNELS.wishlistSave, payload),
    remove: (payload) => ipcRenderer.invoke(IPC_CHANNELS.wishlistRemove, payload),
    update: (payload) => ipcRenderer.invoke(IPC_CHANNELS.wishlistUpdate, payload)
  },
  books: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.booksList),
    addSample: () => ipcRenderer.invoke(IPC_CHANNELS.booksAddSample),
    import: () => ipcRenderer.invoke(IPC_CHANNELS.booksImport),
    reveal: (payload) => ipcRenderer.invoke(IPC_CHANNELS.booksReveal, payload),
    delete: (payload) => ipcRenderer.invoke(IPC_CHANNELS.booksDelete, payload),
    getPdfData: (payload) => ipcRenderer.invoke(IPC_CHANNELS.booksGetPdfData, payload),
    getEpubData: (payload) => ipcRenderer.invoke(IPC_CHANNELS.booksGetEpubData, payload),
    getFb2Data: (payload) => ipcRenderer.invoke(IPC_CHANNELS.booksGetFb2Data, payload),
    getTxtData: (payload) => ipcRenderer.invoke(IPC_CHANNELS.booksGetTxtData, payload)
  },
  notes: {
    create: (payload) => ipcRenderer.invoke(IPC_CHANNELS.notesCreate, payload),
    list: (payload) => ipcRenderer.invoke(IPC_CHANNELS.notesList, payload),
    delete: (payload) => ipcRenderer.invoke(IPC_CHANNELS.notesDelete, payload),
    update: (payload) => ipcRenderer.invoke(IPC_CHANNELS.notesUpdate, payload)
  },
  highlights: {
    list: (payload) => ipcRenderer.invoke(IPC_CHANNELS.highlightsList, payload),
    createMerged: (payload) => ipcRenderer.invoke(IPC_CHANNELS.highlightsCreateMerged, payload),
    delete: (payload) => ipcRenderer.invoke(IPC_CHANNELS.highlightsDelete, payload),
    insertRaw: (payload) => ipcRenderer.invoke(IPC_CHANNELS.highlightsInsertRaw, payload),
    updateNote: (payload) => ipcRenderer.invoke(IPC_CHANNELS.highlightsUpdateNote, payload)
  },
  epubHighlights: {
    list: (payload) => ipcRenderer.invoke(IPC_CHANNELS.epubHighlightsList, payload),
    create: (payload) => ipcRenderer.invoke(IPC_CHANNELS.epubHighlightsCreate, payload)
  },
  bookmarks: {
    list: (payload) => ipcRenderer.invoke(IPC_CHANNELS.bookmarksList, payload),
    toggle: (payload) => ipcRenderer.invoke(IPC_CHANNELS.bookmarksToggle, payload),
    remove: (payload) => ipcRenderer.invoke(IPC_CHANNELS.bookmarksRemove, payload)
  },
  epubBookmarks: {
    list: (payload) => ipcRenderer.invoke(IPC_CHANNELS.epubBookmarksList, payload),
    toggle: (payload) => ipcRenderer.invoke(IPC_CHANNELS.epubBookmarksToggle, payload)
  },
  export: {
    getBookData: (payload) => ipcRenderer.invoke(IPC_CHANNELS.exportGetBookData, payload),
    saveFile: (payload) => ipcRenderer.invoke(IPC_CHANNELS.exportSaveFile, payload)
  },
  epubProgress: {
    get: (payload) => ipcRenderer.invoke(IPC_CHANNELS.epubProgressGet, payload),
    set: (payload) => ipcRenderer.invoke(IPC_CHANNELS.epubProgressSet, payload)
  },
  flowProgress: {
    get: (payload) => ipcRenderer.invoke(IPC_CHANNELS.flowProgressGet, payload),
    set: (payload) => ipcRenderer.invoke(IPC_CHANNELS.flowProgressSet, payload)
  },
  readerSettings: {
    get: (payload) => ipcRenderer.invoke(IPC_CHANNELS.readerSettingsGet, payload),
    update: (payload) => ipcRenderer.invoke(IPC_CHANNELS.readerSettingsUpdate, payload)
  },
  stats: {
    markOpened: (payload) => ipcRenderer.invoke(IPC_CHANNELS.statsMarkOpened, payload),
    getRecentBooks: () => ipcRenderer.invoke(IPC_CHANNELS.statsGetRecentBooks)
  },
  aiSummaries: {
    save: (payload) => ipcRenderer.invoke(IPC_CHANNELS.aiSummariesSave, payload),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.aiSummariesList),
    get: (payload) => ipcRenderer.invoke(IPC_CHANNELS.aiSummariesGet, payload),
    delete: (payload) => ipcRenderer.invoke(IPC_CHANNELS.aiSummariesDelete, payload)
  },
  getLastPage: (payload) => ipcRenderer.invoke(IPC_CHANNELS.progressGetLastPage, payload),
  setLastPage: (payload) => ipcRenderer.invoke(IPC_CHANNELS.progressSetLastPage, payload)
};

contextBridge.exposeInMainWorld('api', api);
