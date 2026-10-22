// Simule une page compromise qui aurait accès à ipcRenderer.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sonde', { invoke: (c, p) => ipcRenderer.invoke(c, p) });
