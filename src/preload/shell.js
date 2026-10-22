const { contextBridge, ipcRenderer } = require('electron');

// L'unique pont entre le shell et le process principal : trois fonctions, pas
// d'ipcRenderer brut. Chaque action est vérifiée (liste blanche + schéma) côté
// principal.
contextBridge.exposeInMainWorld('escale', {
  plateforme: process.platform,
  etatInitial: () => ipcRenderer.invoke('etat:initial', {}),
  surDelta: (fn) => {
    const ecoute = (_event, delta) => fn(delta);
    ipcRenderer.on('etat:delta', ecoute);
    return () => ipcRenderer.removeListener('etat:delta', ecoute);
  },
  action: (nom, payload) => ipcRenderer.invoke('action', { nom, payload })
});
