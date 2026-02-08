import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type RendererApi } from '../shared/ipc';

const api: RendererApi = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping),
  auth: {
    signUp: (payload) => ipcRenderer.invoke(IPC_CHANNELS.authSignUp, payload),
    signIn: (payload) => ipcRenderer.invoke(IPC_CHANNELS.authSignIn, payload),
    getCurrentUser: (payload) => ipcRenderer.invoke(IPC_CHANNELS.authGetCurrentUser, payload),
    signOut: (payload) => ipcRenderer.invoke(IPC_CHANNELS.authSignOut, payload)
  }
};

contextBridge.exposeInMainWorld('api', api);
