/*
 * Preload des service workers d'extension : un chrome.webRequest.onBeforeRequest
 * qui fonctionne, alimenté par le principal (src/main/webrequest-ext.js).
 * Enregistré AVANT celui d'electron-chrome-extensions, qui fige `chrome` après
 * avoir posé ses propres API.
 */
const { contextBridge, ipcRenderer } = require('electron');

const EVENEMENT = 'webRequest.onBeforeRequest';

if (process.type === 'service-worker') {
  contextBridge.exposeInMainWorld('escaleWebRequest', {
    ecouter(extensionId, fn) {
      ipcRenderer.on(`crx-${EVENEMENT}`, (_e, details) => fn(details));
      ipcRenderer.send('crx-add-listener', extensionId, EVENEMENT);
    }
  });
  contextBridge.executeInMainWorld({
    func: () => {
      const pont = globalThis.escaleWebRequest;
      delete globalThis.escaleWebRequest;
      const chrome = globalThis.chrome;
      if (!chrome?.runtime?.id || !chrome.webRequest) return;

      // Motifs d'URL de Chrome (« *://*.exemple.fr/* », « <all_urls> »), en
      // version simple : `*` vaut n'importe quelle suite de caractères.
      const correspond = (motif, url) =>
        motif === '<all_urls>' ||
        new RegExp(`^${motif.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(url);
      const accepte = (filtre, d) =>
        (!filtre.urls || filtre.urls.some((m) => correspond(m, d.url))) &&
        (!filtre.types || filtre.types.includes(d.type)) &&
        (filtre.tabId === undefined || filtre.tabId === d.tabId);

      const ecouteurs = new Map();
      let branche = false;
      const onBeforeRequest = {
        addListener(fn, filtre = {}) {
          ecouteurs.set(fn, filtre);
          if (branche) return;
          branche = true;
          pont.ecouter(chrome.runtime.id, (d) => {
            for (const [f, fl] of ecouteurs) {
              if (!accepte(fl, d)) continue;
              try {
                f(d);
              } catch (e) {
                console.error(e);
              }
            }
          });
        },
        removeListener: (fn) => ecouteurs.delete(fn),
        hasListener: (fn) => ecouteurs.has(fn),
        hasListeners: () => ecouteurs.size > 0
      };
      Object.defineProperty(chrome, 'webRequest', {
        value: { ...chrome.webRequest, onBeforeRequest },
        enumerable: true,
        configurable: true
      });
    }
  });
}
