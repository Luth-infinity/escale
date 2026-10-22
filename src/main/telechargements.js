const { app, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const ipc = require('./ipc');

/**
 * Les téléchargements ordinaires (hors vidéos YouTube, voir videos.js) : rangés
 * d'office dans le dossier Téléchargements, comme Chrome, et suivis en bas de
 * la barre (même ligne et mêmes deltas `video:etat` que les vidéos).
 */
const enCours = new Map(); // id → DownloadItem
const finis = new Map(); // id → chemin
let suivant = 0;

/** Un nom libre dans le dossier : « rapport (2).pdf » si « rapport.pdf » existe. */
function cheminLibre(dossier, nom) {
  const ext = path.extname(nom);
  const base = path.basename(nom, ext) || 'telechargement';
  let candidat = path.join(dossier, base + ext);
  for (let n = 2; fs.existsSync(candidat) || [...enCours.values()].some((i) => i.getSavePath() === candidat); n++) {
    candidat = path.join(dossier, `${base} (${n})${ext}`);
  }
  return candidat;
}

/** À appeler dans `will-download`, avant tout autre traitement de l'élément. */
function suivre(item) {
  const id = `d${(++suivant).toString(36)}${Date.now().toString(36)}`;
  item.setSavePath(cheminLibre(app.getPath('downloads'), item.getFilename()));
  enCours.set(id, item);
  const signaler = (etat, extra = {}) =>
    ipc.emettre({ type: 'video:etat', id, nom: path.basename(item.getSavePath()), recu: item.getReceivedBytes(), total: item.getTotalBytes(), etat, ...extra });
  let dernier = 0;
  signaler('en-cours');
  item.on('updated', (_e, etat) => {
    if (etat === 'interrupted') return signaler('en-cours', { detail: '' });
    const maintenant = Date.now();
    if (maintenant - dernier < 250) return;
    dernier = maintenant;
    signaler('en-cours');
  });
  item.once('done', (_e, etat) => {
    enCours.delete(id);
    if (etat === 'completed') {
      finis.set(id, item.getSavePath());
      signaler('fini');
    } else if (etat === 'cancelled') signaler('annule');
    else signaler('echec', { erreur: '' });
  });
  return id;
}

function annuler(id) {
  enCours.get(id)?.cancel();
}

function montrer(id) {
  const chemin = finis.get(id);
  if (chemin) shell.showItemInFolder(chemin);
  else shell.openPath(app.getPath('downloads'));
}

const estLeMien = (id) => id.startsWith('d');

module.exports = { suivre, annuler, montrer, estLeMien };
