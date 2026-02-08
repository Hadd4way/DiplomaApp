import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type RendererApi } from '../shared/ipc';

const api: RendererApi = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping)
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('electronAPI', api);
