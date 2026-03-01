import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type RendererApi } from '../shared/ipc';

const api: RendererApi = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping),
  auth: {
    signUp: (payload) => ipcRenderer.invoke(IPC_CHANNELS.authSignUp, payload),
    signIn: (payload) => ipcRenderer.invoke(IPC_CHANNELS.authSignIn, payload),
    getCurrentUser: (payload) => ipcRenderer.invoke(IPC_CHANNELS.authGetCurrentUser, payload),
    signOut: (payload) => ipcRenderer.invoke(IPC_CHANNELS.authSignOut, payload)
  },
  books: {
    list: (payload) => ipcRenderer.invoke(IPC_CHANNELS.booksList, payload),
    addSample: (payload) => ipcRenderer.invoke(IPC_CHANNELS.booksAddSample, payload),
    import: (payload) => ipcRenderer.invoke(IPC_CHANNELS.booksImport, payload),
    reveal: (payload) => ipcRenderer.invoke(IPC_CHANNELS.booksReveal, payload),
    delete: (payload) => ipcRenderer.invoke(IPC_CHANNELS.booksDelete, payload),
    getPdfData: (payload) => ipcRenderer.invoke(IPC_CHANNELS.booksGetPdfData, payload)
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
    insertRaw: (payload) => ipcRenderer.invoke(IPC_CHANNELS.highlightsInsertRaw, payload)
  },
  bookmarks: {
    list: (payload) => ipcRenderer.invoke(IPC_CHANNELS.bookmarksList, payload),
    toggle: (payload) => ipcRenderer.invoke(IPC_CHANNELS.bookmarksToggle, payload),
    remove: (payload) => ipcRenderer.invoke(IPC_CHANNELS.bookmarksRemove, payload)
  },
  getLastPage: (userId, bookId) => ipcRenderer.invoke(IPC_CHANNELS.progressGetLastPage, { userId, bookId }),
  setLastPage: (userId, bookId, lastPage) =>
    ipcRenderer.invoke(IPC_CHANNELS.progressSetLastPage, { userId, bookId, lastPage })
};

contextBridge.exposeInMainWorld('api', api);
