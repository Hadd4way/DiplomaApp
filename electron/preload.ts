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
    delete: (payload) => ipcRenderer.invoke(IPC_CHANNELS.booksDelete, payload)
  }
};

contextBridge.exposeInMainWorld('api', api);
