/**
 * Le modèle d'Escale : espaces, dossiers et onglets, en fonctions pures.
 *
 * Chaque opération prend l'état et renvoie { etat, deltas } sans jamais muter
 * l'entrée. Les deltas sont exactement ce que le shell reçoit : rien n'est
 * émis quand rien ne change (une valeur identique ne produit aucun delta).
 *
 * Rangement : dans un espace, chaque parent (racine ou dossier) a deux zones.
 * La zone « epingles » mêle dossiers et onglets épinglés ; la zone « jour »
 * (racine seulement) tient les onglets non épinglés, sous le séparateur.
 * Un onglet dans un dossier est toujours épinglé.
 */
const { randomUUID } = require('node:crypto');
const { entre, repartir } = require('./ordre');

const CLE_MAX = 24;

function creerEspace({ nom, teinte = null, icone = null }) {
  const id = randomUUID();
  return { id, nom, icone, teinte, partition: `persist:space-${id}` };
}

function creerEtat() {
  const espace = creerEspace({ nom: 'Perso' });
  return { version: 1, espaces: [espace], dossiers: [], onglets: [], espaceActif: espace.id, ongletActif: null, actifs: {} };
}

const zoneDe = (o) => (o.epingle ? 'epingles' : 'jour');

// Les éléments d'une zone, triés : [{ id, type, ordre }].
function freres(etat, espaceId, parentId, zone) {
  const liste = etat.onglets
    .filter((o) => o.espaceId === espaceId && o.dossierId === parentId && zoneDe(o) === zone)
    .map((o) => ({ id: o.id, type: 'onglet', ordre: o.ordre }));
  if (zone === 'epingles') {
    for (const d of etat.dossiers) {
      if (d.espaceId === espaceId && d.parentId === parentId) liste.push({ id: d.id, type: 'dossier', ordre: d.ordre });
    }
  }
  return liste.sort((a, b) => (a.ordre < b.ordre ? -1 : a.ordre > b.ordre ? 1 : 0));
}

/**
 * Clé pour un élément posé entre `apres` (au-dessus) et `avant` (au-dessous),
 * ou en fin de zone sans voisins. Renvoie { cle, reordre } : `reordre` liste
 * les autres éléments à renuméroter quand la clé devient trop longue.
 */
function placer(liste, id, apres, avant) {
  const autres = liste.filter((x) => x.id !== id);
  let i;
  if (apres) i = autres.findIndex((x) => x.id === apres) + 1;
  else if (avant) i = Math.max(0, autres.findIndex((x) => x.id === avant));
  else i = autres.length;
  if (i === 0 && apres) i = autres.length; // voisin introuvable : en fin de zone
  const bas = i > 0 ? autres[i - 1].ordre : null;
  const haut = i < autres.length ? autres[i].ordre : null;
  const cle = entre(bas, haut);
  if (cle.length <= CLE_MAX) return { cle, reordre: [] };
  const neuves = repartir(autres.length + 1);
  const reordre = [];
  autres.forEach((x, j) => reordre.push({ ...x, ordre: neuves[j < i ? j : j + 1] }));
  return { cle: neuves[i], reordre };
}

function appliquerReordre(etat, reordre, deltas) {
  if (!reordre.length) return etat;
  const map = new Map(reordre.map((x) => [x.id, x.ordre]));
  const onglets = etat.onglets.map((o) => (map.has(o.id) ? { ...o, ordre: map.get(o.id) } : o));
  const dossiers = etat.dossiers.map((d) => (map.has(d.id) ? { ...d, ordre: map.get(d.id) } : d));
  for (const x of reordre) {
    if (x.type === 'onglet') {
      const o = onglets.find((y) => y.id === x.id);
      deltas.push(deltaDeplace(o));
    } else deltas.push({ type: 'folder:changed', id: x.id, patch: { ordre: x.ordre } });
  }
  return { ...etat, onglets, dossiers };
}

const deltaDeplace = (o) => ({
  type: 'tab:moved', id: o.id, espaceId: o.espaceId, dossierId: o.dossierId, epingle: o.epingle, ordre: o.ordre
});

const trouverOnglet = (etat, id) => {
  const o = etat.onglets.find((x) => x.id === id);
  if (!o) throw new Error(`onglet-inconnu: ${id}`);
  return o;
};
const trouverDossier = (etat, id) => {
  const d = etat.dossiers.find((x) => x.id === id);
  if (!d) throw new Error(`dossier-inconnu: ${id}`);
  return d;
};

// ---- Espaces ----

function ajouterEspace(etat, donnees) {
  const espace = creerEspace(donnees);
  return { etat: { ...etat, espaces: [...etat.espaces, espace] }, deltas: [{ type: 'space:added', espace }] };
}

function modifierEspace(etat, id, patch) {
  const e = etat.espaces.find((x) => x.id === id);
  if (!e) throw new Error(`espace-inconnu: ${id}`);
  const change = {};
  for (const k of ['nom', 'icone', 'teinte']) if (k in patch && patch[k] !== e[k]) change[k] = patch[k];
  if (!Object.keys(change).length) return { etat, deltas: [] };
  return {
    etat: { ...etat, espaces: etat.espaces.map((x) => (x.id === id ? { ...x, ...change } : x)) },
    deltas: [{ type: 'space:changed', id, patch: change }]
  };
}

function supprimerEspace(etat, id) {
  if (etat.espaces.length <= 1) throw new Error('dernier-espace');
  const deltas = [];
  const espaces = etat.espaces.filter((e) => e.id !== id);
  const partis = etat.onglets.filter((o) => o.espaceId === id);
  for (const o of partis) deltas.push({ type: 'tab:removed', id: o.id, onglet: o });
  for (const d of etat.dossiers.filter((x) => x.espaceId === id)) deltas.push({ type: 'folder:removed', id: d.id });
  deltas.push({ type: 'space:removed', id });
  let suivant = { ...etat, espaces, onglets: etat.onglets.filter((o) => o.espaceId !== id), dossiers: etat.dossiers.filter((d) => d.espaceId !== id) };
  if (etat.espaceActif === id || partis.some((o) => o.id === etat.ongletActif)) {
    suivant = { ...suivant, espaceActif: espaces[0].id, ongletActif: null };
    deltas.push({ type: 'active:changed', espaceActif: suivant.espaceActif, ongletActif: null });
  }
  return { etat: suivant, deltas };
}

function activerEspace(etat, id) {
  if (!etat.espaces.some((e) => e.id === id)) throw new Error(`espace-inconnu: ${id}`);
  if (etat.espaceActif === id) return { etat, deltas: [] };
  // Chaque espace rouvre sur son dernier onglet consulté (retenu par activer),
  // à défaut sur le plus récemment actif.
  const retenu = etat.actifs?.[id];
  const ongletActif = etat.onglets.some((o) => o.id === retenu && o.espaceId === id)
    ? retenu
    : etat.onglets
        .filter((o) => o.espaceId === id)
        .reduce((m, o) => (!m || o.derniereActivite > m.derniereActivite ? o : m), null)?.id ?? null;
  return {
    etat: { ...etat, espaceActif: id, ongletActif },
    deltas: [{ type: 'active:changed', espaceActif: id, ongletActif }]
  };
}

// ---- Dossiers ----

function ajouterDossier(etat, { espaceId, parentId = null, nom }) {
  const { cle, reordre } = placer(freres(etat, espaceId, parentId, 'epingles'), null, null, null);
  const deltas = [];
  const dossier = { id: randomUUID(), espaceId, parentId, nom, teinte: null, replie: false, ordre: cle };
  let suivant = appliquerReordre(etat, reordre, deltas);
  suivant = { ...suivant, dossiers: [...suivant.dossiers, dossier] };
  return { etat: suivant, deltas: [{ type: 'folder:added', dossier }, ...deltas] };
}

function modifierDossier(etat, id, patch) {
  const d = trouverDossier(etat, id);
  const change = {};
  for (const k of ['nom', 'teinte', 'replie']) if (k in patch && patch[k] !== d[k]) change[k] = patch[k];
  if (!Object.keys(change).length) return { etat, deltas: [] };
  return {
    etat: { ...etat, dossiers: etat.dossiers.map((x) => (x.id === id ? { ...x, ...change } : x)) },
    deltas: [{ type: 'folder:changed', id, patch: change }]
  };
}

/** Supprime le dossier ; son contenu remonte d'un cran, à sa place. */
function supprimerDossier(etat, id) {
  const d = trouverDossier(etat, id);
  const zone = freres(etat, d.espaceId, d.parentId, 'epingles');
  const i = zone.findIndex((x) => x.id === id);
  const haut = i + 1 < zone.length ? zone[i + 1].ordre : null;
  let bas = i > 0 ? zone[i - 1].ordre : null;
  const enfants = freres(etat, d.espaceId, id, 'epingles');
  const deltas = [];
  const cles = new Map();
  for (const e of enfants) {
    bas = entre(bas, haut);
    cles.set(e.id, bas);
  }
  const onglets = etat.onglets.map((o) => (cles.has(o.id) ? { ...o, dossierId: d.parentId, ordre: cles.get(o.id) } : o));
  const dossiers = etat.dossiers
    .filter((x) => x.id !== id)
    .map((x) => (cles.has(x.id) ? { ...x, parentId: d.parentId, ordre: cles.get(x.id) } : x));
  for (const e of enfants) {
    if (e.type === 'onglet') deltas.push(deltaDeplace(onglets.find((o) => o.id === e.id)));
    else deltas.push({ type: 'folder:changed', id: e.id, patch: { parentId: d.parentId, ordre: cles.get(e.id) } });
  }
  deltas.push({ type: 'folder:removed', id });
  return { etat: { ...etat, onglets, dossiers }, deltas };
}

// ---- Onglets ----

function ouvrirOnglet(etat, { espaceId, url, apres = null }) {
  const voisin = apres ? etat.onglets.find((o) => o.id === apres) : null;
  // Un lien ouvert depuis un épinglé atterrit en tête des onglets du jour.
  const sousOuvreur = voisin && !voisin.epingle && voisin.espaceId === espaceId;
  const liste = freres(etat, espaceId, null, 'jour');
  const avant = voisin && !sousOuvreur ? liste[0]?.id ?? null : null;
  const { cle, reordre } = placer(liste, null, sousOuvreur ? apres : null, avant);
  const deltas = [];
  const onglet = {
    id: randomUUID(), espaceId, dossierId: null, epingle: false, url, titre: '', favicon: null,
    ordre: cle, derniereActivite: Date.now(), muet: false, zoom: 1
  };
  let suivant = appliquerReordre(etat, reordre, deltas);
  suivant = { ...suivant, onglets: [...suivant.onglets, onglet] };
  return { etat: suivant, deltas: [{ type: 'tab:added', onglet }, ...deltas] };
}

function voisinApresFermeture(etat, o) {
  const liste = freres(etat, o.espaceId, o.dossierId, zoneDe(o));
  const i = liste.findIndex((x) => x.id === o.id);
  const candidats = [...liste.slice(i + 1), ...liste.slice(0, i).reverse()].filter((x) => x.type === 'onglet');
  return candidats[0]?.id ?? null;
}

function fermerOnglet(etat, id) {
  const o = trouverOnglet(etat, id);
  const deltas = [{ type: 'tab:removed', id, onglet: o }];
  let suivant = { ...etat, onglets: etat.onglets.filter((x) => x.id !== id) };
  if (etat.ongletActif === id) {
    const ongletActif = voisinApresFermeture(etat, o);
    suivant = { ...suivant, ongletActif };
    deltas.push({ type: 'active:changed', espaceActif: suivant.espaceActif, ongletActif });
  }
  return { etat: suivant, deltas };
}

function activer(etat, id, maintenant = Date.now()) {
  const o = trouverOnglet(etat, id);
  const onglets = etat.onglets.map((x) => (x.id === id ? { ...x, derniereActivite: maintenant } : x));
  const actifs = { ...etat.actifs, [o.espaceId]: id };
  if (etat.ongletActif === id && etat.espaceActif === o.espaceId) return { etat: { ...etat, onglets, actifs }, deltas: [] };
  return {
    etat: { ...etat, onglets, actifs, ongletActif: id, espaceActif: o.espaceId },
    deltas: [{ type: 'active:changed', espaceActif: o.espaceId, ongletActif: id }]
  };
}

const CHAMPS_META = ['titre', 'favicon', 'url', 'muet', 'zoom'];

function majMeta(etat, id, patch) {
  const o = trouverOnglet(etat, id);
  const change = {};
  for (const k of CHAMPS_META) if (k in patch && patch[k] !== o[k]) change[k] = patch[k];
  if (!Object.keys(change).length) return { etat, deltas: [] };
  return {
    etat: { ...etat, onglets: etat.onglets.map((x) => (x.id === id ? { ...x, ...change } : x)) },
    deltas: [{ type: 'tab:meta', id, patch: change }]
  };
}

function epingler(etat, id, oui) {
  const o = trouverOnglet(etat, id);
  if (o.epingle === oui) return { etat, deltas: [] };
  // Épingler : en fin des épinglés de la racine. Désépingler : en tête du jour.
  const liste = freres(etat, o.espaceId, null, oui ? 'epingles' : 'jour');
  const { cle, reordre } = placer(liste, id, null, oui ? null : liste[0]?.id ?? null);
  const deltas = [];
  let suivant = appliquerReordre(etat, reordre, deltas);
  const nouveau = { ...o, epingle: oui, dossierId: null, ordre: cle };
  suivant = { ...suivant, onglets: suivant.onglets.map((x) => (x.id === id ? nouveau : x)) };
  return { etat: suivant, deltas: [deltaDeplace(nouveau), ...deltas] };
}

function estDescendant(etat, dossierId, ancetreId) {
  for (let d = dossierId; d; d = etat.dossiers.find((x) => x.id === d)?.parentId ?? null) {
    if (d === ancetreId) return true;
  }
  return false;
}

/**
 * Déplace un onglet ou un dossier. `apres` est l'élément qui sera juste
 * au-dessus, `avant` celui juste au-dessous (l'un ou l'autre suffit).
 * `epingle` force la zone d'un onglet posé à la racine (sinon déduite du voisin).
 */
function deplacer(etat, { id, type, dossierId = null, avant = null, apres = null, epingle: force }) {
  if (type === 'dossier') {
    const d = trouverDossier(etat, id);
    if (dossierId && estDescendant(etat, dossierId, id)) throw new Error('cycle');
    const { cle, reordre } = placer(freres(etat, d.espaceId, dossierId, 'epingles'), id, apres, avant);
    const deltas = [];
    let suivant = appliquerReordre(etat, reordre, deltas);
    suivant = { ...suivant, dossiers: suivant.dossiers.map((x) => (x.id === id ? { ...x, parentId: dossierId, ordre: cle } : x)) };
    return { etat: suivant, deltas: [{ type: 'folder:changed', id, patch: { parentId: dossierId, ordre: cle } }, ...deltas] };
  }
  const o = trouverOnglet(etat, id);
  let epingle = o.epingle;
  if (dossierId) epingle = true;
  else if (typeof force === 'boolean') epingle = force;
  else {
    const voisin = etat.onglets.find((x) => x.id === (apres || avant)) || etat.dossiers.find((x) => x.id === (apres || avant));
    if (voisin) epingle = 'parentId' in voisin ? true : voisin.epingle;
  }
  const liste = freres(etat, o.espaceId, dossierId, epingle ? 'epingles' : 'jour');
  const { cle, reordre } = placer(liste, id, apres, avant);
  const deltas = [];
  let suivant = appliquerReordre(etat, reordre, deltas);
  const nouveau = { ...o, dossierId, epingle, ordre: cle };
  suivant = { ...suivant, onglets: suivant.onglets.map((x) => (x.id === id ? nouveau : x)) };
  return { etat: suivant, deltas: [deltaDeplace(nouveau), ...deltas] };
}

/** Ferme les onglets du jour inactifs depuis plus de `delaiMs` (0 = jamais). */
function fermerInactifs(etat, maintenant, delaiMs) {
  if (!delaiMs) return { etat, deltas: [] };
  const limite = maintenant - delaiMs;
  const deltas = [];
  let suivant = etat;
  for (const o of etat.onglets) {
    if (o.epingle || o.id === etat.ongletActif || o.derniereActivite >= limite) continue;
    const r = fermerOnglet(suivant, o.id);
    suivant = r.etat;
    deltas.push(...r.deltas);
  }
  return { etat: suivant, deltas };
}

module.exports = {
  creerEtat, ajouterEspace, modifierEspace, supprimerEspace, activerEspace,
  ajouterDossier, modifierDossier, supprimerDossier,
  ouvrirOnglet, fermerOnglet, activer, majMeta, epingler, deplacer, fermerInactifs,
  freres
};
