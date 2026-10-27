const A = require('./model/arbre');
const store = require('./store');
const ipc = require('./ipc');

/**
 * Le détenteur de l'état : chaque opération du modèle passe par appliquer(),
 * qui garde le nouvel état, planifie l'écriture et diffuse les deltas au shell
 * et aux modules du process principal (onglets, menu…).
 */
const REGLAGES = {
  fermetureAutoHeures: 12,
  veilleMinutes: 20,
  bloqueur: true,
  suggestions: true,
  moteur: 'google',
  langue: 'system',
  theme: 'system',
  barreRepliee: false,
  barreMasquee: false,
  // Apparence
  accent: null, // null = le vert d'eau d'Escale
  intensiteTeinte: 1,
  cadre: 'arrondi',
  largeurBarre: 240,
  ambiance: false,
  sponsors: true,
  derniereVersionVue: null,
  zoom: {} // hôte → facteur
};

let etat = null;
let dossier = null;
const ecouteurs = new Set();

function init(dir) {
  dossier = dir;
  const lu = store.charger(dir);
  etat = { ...lu, reglages: { ...REGLAGES, ...(lu.reglages || {}) } };
  // La navigation privée ne survit pas à la fermeture : ses espaces partent,
  // avec leurs onglets et leurs dossiers.
  for (const e of etat.espaces.filter((x) => x.prive)) {
    if (etat.espaces.length > 1) etat = A.supprimerEspace(etat, e.id).etat;
  }
  return etat;
}

const lire = () => etat;
const reglages = () => etat.reglages;

function appliquer(op, ...args) {
  const r = A[op](etat, ...args);
  if (r.etat !== etat) {
    etat = r.etat;
    store.planifierEcriture(dossier, etat);
  }
  for (const d of r.deltas) {
    ipc.emettre(d);
    for (const f of ecouteurs) f(d, etat);
  }
  return r;
}

function regler(patch) {
  const change = Object.entries(patch).filter(([k, v]) => k in REGLAGES && etat.reglages[k] !== v);
  if (!change.length) return;
  etat = { ...etat, reglages: { ...etat.reglages, ...Object.fromEntries(change) } };
  store.planifierEcriture(dossier, etat);
  const delta = { type: 'settings:changed', patch: Object.fromEntries(change) };
  ipc.emettre(delta);
  for (const f of ecouteurs) f(delta, etat);
}

function ecouter(f) {
  ecouteurs.add(f);
  return () => ecouteurs.delete(f);
}

module.exports = { init, lire, reglages, appliquer, regler, ecouter, ecrireMaintenant: () => store.ecrireMaintenant(dossier, etat) };
