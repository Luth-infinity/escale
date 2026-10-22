const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('spike', { bounds: (w) => ipcRenderer.send('bounds', w) });
