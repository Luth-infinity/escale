const test = require('node:test');
const assert = require('node:assert');
const A = require('../src/main/model/arbre');

function base() {
  let etat = A.creerEtat();
  const espaceId = etat.espaceActif;
  return { etat, espaceId };
}
const ouvrir = (etat, espaceId, url, extra = {}) => {
  const r = A.ouvrirOnglet(etat, { espaceId, url, ...extra });
  return { etat: r.etat, id: r.deltas.find((d) => d.type === 'tab:added').onglet.id, deltas: r.deltas };
};

test('creerEtat : version 1, un espace actif avec sa partition figée', () => {
  const etat = A.creerEtat();
  assert.strictEqual(etat.version, 1);
  assert.strictEqual(etat.espaces.length, 1);
  assert.strictEqual(etat.espaces[0].partition, `persist:space-${etat.espaces[0].id}`);
  assert.strictEqual(etat.espaceActif, etat.espaces[0].id);
  assert.strictEqual(etat.ongletActif, null);
});

test('majMeta avec une valeur identique ne produit aucun delta', () => {
  let { etat, espaceId } = base();
  let o = ouvrir(etat, espaceId, 'https://a.fr');
  let r = A.majMeta(o.etat, o.id, { titre: 'A' });
  assert.strictEqual(r.deltas.length, 1);
  const r2 = A.majMeta(r.etat, o.id, { titre: 'A' });
  assert.deepStrictEqual(r2.deltas, []);
  assert.strictEqual(r2.etat, r.etat);
});

test('supprimerDossier non vide : enfants rattachés au parent, aucun onglet perdu', () => {
  let { etat, espaceId } = base();
  let r = A.ajouterDossier(etat, { espaceId, parentId: null, nom: 'Parent' });
  const parent = r.deltas[0].dossier.id;
  r = A.ajouterDossier(r.etat, { espaceId, parentId: parent, nom: 'Enfant' });
  const enfant = r.deltas[0].dossier.id;
  r = A.ajouterDossier(r.etat, { espaceId, parentId: enfant, nom: 'Petit' });
  const petit = r.deltas[0].dossier.id;
  let o = ouvrir(r.etat, espaceId, 'https://a.fr');
  r = A.deplacer(o.etat, { id: o.id, type: 'onglet', dossierId: enfant, avant: null, apres: null });
  r = A.supprimerDossier(r.etat, enfant);
  assert.strictEqual(r.etat.onglets.length, 1);
  assert.strictEqual(r.etat.onglets[0].dossierId, parent);
  assert.strictEqual(r.etat.dossiers.find((d) => d.id === petit).parentId, parent);
  assert.ok(!r.etat.dossiers.some((d) => d.id === enfant));
});

test('supprimerEspace refuse le dernier espace', () => {
  const { etat, espaceId } = base();
  assert.throws(() => A.supprimerEspace(etat, espaceId), /dernier-espace/);
});

test('supprimerEspace emporte ses onglets et dossiers, et change l’espace actif', () => {
  let { etat, espaceId } = base();
  let r = A.ajouterEspace(etat, { nom: 'Boulot', teinte: '#3a7' });
  const boulot = r.deltas[0].espace.id;
  let o = ouvrir(r.etat, boulot, 'https://b.fr');
  r = A.activer(o.etat, o.id);
  r = A.supprimerEspace(r.etat, boulot);
  assert.strictEqual(r.etat.onglets.length, 0);
  assert.strictEqual(r.etat.espaceActif, espaceId);
});

test('deplacer un dossier dans son propre descendant lève cycle', () => {
  let { etat, espaceId } = base();
  let r = A.ajouterDossier(etat, { espaceId, parentId: null, nom: 'A' });
  const a = r.deltas[0].dossier.id;
  r = A.ajouterDossier(r.etat, { espaceId, parentId: a, nom: 'B' });
  const b = r.deltas[0].dossier.id;
  assert.throws(() => A.deplacer(r.etat, { id: a, type: 'dossier', dossierId: b, avant: null, apres: null }), /cycle/);
  assert.throws(() => A.deplacer(r.etat, { id: a, type: 'dossier', dossierId: a, avant: null, apres: null }), /cycle/);
});

test('fermerInactifs : non épinglés inactifs > délai, jamais épinglé ni actif', () => {
  let { etat, espaceId } = base();
  const H = 3600e3;
  let vieux = ouvrir(etat, espaceId, 'https://vieux.fr');
  let epingle = ouvrir(vieux.etat, espaceId, 'https://epingle.fr');
  let actif = ouvrir(epingle.etat, espaceId, 'https://actif.fr');
  let recent = ouvrir(actif.etat, espaceId, 'https://recent.fr');
  let e = A.epingler(recent.etat, epingle.id, true).etat;
  e = A.activer(e, actif.id).etat;
  const t0 = 1_000_000_000_000;
  e = { ...e, onglets: e.onglets.map((o) => ({ ...o, derniereActivite: o.id === recent.id ? t0 - 1 * H : t0 - 13 * H })) };
  const r = A.fermerInactifs(e, t0, 12 * H);
  const restants = r.etat.onglets.map((o) => o.url).sort();
  assert.deepStrictEqual(restants, ['https://actif.fr', 'https://epingle.fr', 'https://recent.fr']);
  assert.ok(r.deltas.some((d) => d.type === 'tab:removed' && d.id === vieux.id));
});

test('fermerOnglet sur l’actif : voisin du dessous, sinon du dessus', () => {
  let { etat, espaceId } = base();
  let a = ouvrir(etat, espaceId, 'https://a.fr');
  let b = ouvrir(a.etat, espaceId, 'https://b.fr', { apres: a.id });
  let c = ouvrir(b.etat, espaceId, 'https://c.fr', { apres: b.id });
  let e = A.activer(c.etat, b.id).etat;
  e = A.fermerOnglet(e, b.id).etat;
  assert.strictEqual(e.ongletActif, c.id);
  e = A.fermerOnglet(e, c.id).etat;
  assert.strictEqual(e.ongletActif, a.id);
  e = A.fermerOnglet(e, a.id).etat;
  assert.strictEqual(e.ongletActif, null);
});

test('ouvrirOnglet avec apres : placé juste sous l’ouvreur', () => {
  let { etat, espaceId } = base();
  let a = ouvrir(etat, espaceId, 'https://a.fr');
  let b = ouvrir(a.etat, espaceId, 'https://b.fr');
  let c = ouvrir(b.etat, espaceId, 'https://c.fr', { apres: a.id });
  const tri = [...c.etat.onglets].sort((x, y) => (x.ordre < y.ordre ? -1 : 1)).map((o) => o.url);
  assert.deepStrictEqual(tri, ['https://a.fr', 'https://c.fr', 'https://b.fr']);
});

test('deplacer un non épinglé dans un dossier l’épingle', () => {
  let { etat, espaceId } = base();
  let r = A.ajouterDossier(etat, { espaceId, parentId: null, nom: 'D' });
  const d = r.deltas[0].dossier.id;
  let o = ouvrir(r.etat, espaceId, 'https://a.fr');
  r = A.deplacer(o.etat, { id: o.id, type: 'onglet', dossierId: d, avant: null, apres: null });
  const ong = r.etat.onglets[0];
  assert.strictEqual(ong.dossierId, d);
  assert.strictEqual(ong.epingle, true);
});

test('désépingler un onglet le sort de son dossier', () => {
  let { etat, espaceId } = base();
  let r = A.ajouterDossier(etat, { espaceId, parentId: null, nom: 'D' });
  const d = r.deltas[0].dossier.id;
  let o = ouvrir(r.etat, espaceId, 'https://a.fr');
  r = A.deplacer(o.etat, { id: o.id, type: 'onglet', dossierId: d, avant: null, apres: null });
  r = A.epingler(r.etat, o.id, false);
  assert.strictEqual(r.etat.onglets[0].dossierId, null);
});

test('1000 insertions au même endroit gardent des clés de moins de 40 caractères', () => {
  let { etat, espaceId } = base();
  let a = ouvrir(etat, espaceId, 'https://a.fr');
  let b = ouvrir(a.etat, espaceId, 'https://b.fr');
  let e = b.etat;
  let precedent = a.id;
  for (let i = 0; i < 1000; i++) {
    const o = ouvrir(e, espaceId, `https://x${i}.fr`, { apres: precedent });
    e = o.etat;
    precedent = o.id;
  }
  assert.ok(e.onglets.every((o) => o.ordre.length < 40));
  const tri = [...e.onglets].sort((x, y) => (x.ordre < y.ordre ? -1 : 1));
  assert.strictEqual(tri[0].url, 'https://a.fr');
  assert.strictEqual(tri.at(-1).url, 'https://b.fr');
  assert.strictEqual(tri[1000].url, 'https://x999.fr');
});

test('l’état n’est jamais muté', () => {
  const { etat, espaceId } = base();
  const gele = JSON.stringify(etat);
  ouvrir(etat, espaceId, 'https://a.fr');
  A.ajouterDossier(etat, { espaceId, parentId: null, nom: 'D' });
  assert.strictEqual(JSON.stringify(etat), gele);
});

test('deplacer avec epingle forcé : un épinglé déposé dans un jour vide est désépinglé', () => {
  let { etat, espaceId } = base();
  let o = ouvrir(etat, espaceId, 'https://a.fr');
  let e = A.epingler(o.etat, o.id, true).etat;
  e = A.deplacer(e, { id: o.id, type: 'onglet', dossierId: null, epingle: false }).etat;
  assert.strictEqual(e.onglets[0].epingle, false);
  // Un onglet dans un dossier reste épinglé, même si on demande le contraire.
  let r = A.ajouterDossier(e, { espaceId, nom: 'D' });
  e = A.deplacer(r.etat, { id: o.id, type: 'onglet', dossierId: r.deltas[0].dossier.id, epingle: false }).etat;
  assert.strictEqual(e.onglets[0].epingle, true);
});

test('revenir sur un espace réactive son dernier onglet consulté', () => {
  let { etat, espaceId } = base();
  let a = ouvrir(etat, espaceId, 'https://a.fr');
  let b = ouvrir(a.etat, espaceId, 'https://b.fr');
  let e = A.activer(b.etat, a.id, 1000).etat;
  e = A.activer(e, b.id, 2000).etat;
  let r = A.ajouterEspace(e, { nom: 'Boulot' });
  const boulot = r.deltas[0].espace.id;
  e = A.activerEspace(r.etat, boulot).etat;
  assert.strictEqual(e.ongletActif, null);
  r = A.activerEspace(e, espaceId);
  assert.strictEqual(r.etat.ongletActif, b.id);
  assert.deepStrictEqual(r.deltas, [{ type: 'active:changed', espaceActif: espaceId, ongletActif: b.id }]);
});

test('un onglet ouvert en arrière-plan après coup ne devient pas l’onglet de retour', () => {
  let { etat, espaceId } = base();
  let a = ouvrir(etat, espaceId, 'https://a.fr');
  let e = A.activer(a.etat, a.id, 1000).etat;
  // Ouvert plus tard, jamais consulté.
  e = A.ouvrirOnglet(e, { espaceId, url: 'https://fond.fr' }).etat;
  const r = A.ajouterEspace(e, { nom: 'Boulot' });
  e = A.activerEspace(r.etat, r.deltas[0].espace.id).etat;
  e = A.activerEspace(e, espaceId).etat;
  assert.strictEqual(e.ongletActif, a.id);
});
