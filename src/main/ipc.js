const { ipcMain } = require('electron');
const { estShell } = require('./ipc-garde');
const { valider } = require('./valider');

/**
 * Toute la surface IPC d'Escale passe par ici : chaque appel vérifie que
 * l'expéditeur est bien le shell, puis valide son message contre un schéma.
 * Le shell n'a qu'une entrée générique, `action`, dont le nom est cherché dans
 * une liste blanche : une action non déclarée n'existe pas.
 */
let fenetre = null;
let urlShell = null;
const actions = new Map();

function definirShell(win, url) {
  fenetre = win;
  urlShell = url;
}

function garder(event) {
  if (!estShell(event.senderFrame, urlShell)) throw new Error('expediteur-refuse');
}

function handle(canal, schema, fn) {
  ipcMain.handle(canal, (event, payload) => {
    garder(event);
    return fn(valider(schema, payload), event);
  });
}

/** Déclare une action du shell : son schéma et ce qu'elle fait. */
function action(nom, schema, fn) {
  if (actions.has(nom)) throw new Error(`action-en-double: ${nom}`);
  actions.set(nom, { schema, fn });
}

const nomsActions = () => [...actions.keys()];

ipcMain.handle('action', (event, message) => {
  garder(event);
  const nom = typeof message?.nom === 'string' ? message.nom : '';
  const a = actions.get(nom);
  if (!a) throw new Error(`action-inconnue: ${nom.slice(0, 40)}`);
  return a.fn(valider(a.schema, message.payload ?? {}), event);
});

/** Envoie un delta au shell. */
function emettre(delta) {
  if (fenetre && !fenetre.isDestroyed()) fenetre.webContents.send('etat:delta', delta);
}

module.exports = { definirShell, handle, action, nomsActions, emettre, estShell };
