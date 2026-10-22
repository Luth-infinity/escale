const { dialog } = require('electron');
const ipc = require('./ipc');

/**
 * Les questions posées à l'utilisateur (permission d'un site, extension,
 * téléchargement risqué, lien externe) : une modale du shell, dans le style
 * d'Escale, plutôt qu'une boîte du système. Le shell la pose au-dessus de
 * l'image de la page (useModalePage) et renvoie la réponse par
 * `dialogue.repondre`.
 *
 * Sans shell prêt (fenêtre absente ou en plein chargement), la boîte native
 * reste le repli : une question ne doit jamais rester sans réponse.
 */
let fenetre = null;
let suivant = 0;
const enAttente = new Map(); // id → résolveur

function definirFenetre(win) {
  fenetre = win;
  // Un shell rechargé a perdu ses modales : les questions en cours valent refus.
  const toutRefuser = () => {
    for (const r of enAttente.values()) r(false);
    enAttente.clear();
  };
  win.webContents.on('did-start-loading', toutRefuser);
  win.webContents.on('render-process-gone', toutRefuser);
  win.on('closed', toutRefuser);
}

/**
 * { titre, detail?, points?, avertissement?, annuler, confirmer, ton? } → Promise<boolean>
 * `ton: 'danger'` colore le bouton de confirmation. Annuler reste le choix par défaut.
 */
function demander(q) {
  if (!fenetre || fenetre.isDestroyed() || fenetre.webContents.isLoading()) return natif(q);
  const id = String(++suivant);
  ipc.emettre({
    type: 'dialogue:ouvrir',
    id,
    titre: q.titre,
    detail: q.detail || '',
    points: q.points || [],
    avertissement: q.avertissement || '',
    annuler: q.annuler,
    confirmer: q.confirmer,
    ton: q.ton || 'normal'
  });
  if (fenetre.isMinimized()) fenetre.restore();
  return new Promise((r) => enAttente.set(id, r));
}

async function natif(q) {
  const detail = [q.detail, q.points?.map((p) => `• ${p}`).join('\n'), q.avertissement].filter(Boolean).join('\n\n');
  const options = { type: 'question', buttons: [q.annuler, q.confirmer], defaultId: 0, cancelId: 0, noLink: true, message: q.titre, detail };
  const { response } = fenetre && !fenetre.isDestroyed() ? await dialog.showMessageBox(fenetre, options) : await dialog.showMessageBox(options);
  return response === 1;
}

ipc.action('dialogue.repondre', { type: 'objet', champs: { id: { type: 'string', max: 12 }, oui: { type: 'boolean' } } }, ({ id, oui }) => {
  const r = enAttente.get(id);
  if (!r) return;
  enAttente.delete(id);
  r(oui);
});

module.exports = { definirFenetre, demander };
