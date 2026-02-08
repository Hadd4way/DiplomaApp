"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const ipc_1 = require("../shared/ipc");
const api = {
    ping: () => electron_1.ipcRenderer.invoke(ipc_1.IPC_CHANNELS.ping)
};
electron_1.contextBridge.exposeInMainWorld('api', api);
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
