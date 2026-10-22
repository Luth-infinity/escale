const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const historique = require('../src/main/historique');

const ouvrir = () => {
  const chemin = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'escale-hist-')), 'history.sqlite');
  return { h: historique.ouvrir(chemin), chemin };
};

test('fichier en 0600', () => {
  const { h, chemin } = ouvrir();
  assert.strictEqual(fs.statSync(chemin).mode & 0o777, 0o600);
  h.fermer();
});

test('chercher trouve par préfixe dans l’URL et le titre, trié par fréquence puis récence', () => {
  const { h } = ouvrir();
  h.noterVisite('https://github.com/luth/escale', 'Escale', 1000);
  h.noterVisite('https://gitlab.com/x', 'GitLab', 2000);
  h.noterVisite('https://github.com/luth/escale', 'Escale · dépôt', 3000);
  h.noterVisite('https://exemple.fr', 'Autre chose', 4000);
  const r = h.chercher('git');
  assert.deepStrictEqual(r.map((x) => x.url), ['https://github.com/luth/escale', 'https://gitlab.com/x']);
  assert.strictEqual(r[0].visites, 2);
  assert.strictEqual(r[0].derniere, 3000);
  assert.strictEqual(r[0].titre, 'Escale · dépôt');
  assert.deepStrictEqual(h.chercher('dépôt').map((x) => x.url), ['https://github.com/luth/escale']);
  h.fermer();
});

test('chercher respecte la limite et ignore un texte vide ou fait de ponctuation', () => {
  const { h } = ouvrir();
  for (let i = 0; i < 20; i++) h.noterVisite(`https://site${i}.fr`, `Site ${i}`, i);
  assert.strictEqual(h.chercher('site').length, 8);
  assert.strictEqual(h.chercher('site', 3).length, 3);
  assert.deepStrictEqual(h.chercher(''), []);
  assert.deepStrictEqual(h.chercher('"*('), []);
  h.fermer();
});

test('effacer(depuis) supprime les visites récentes seulement ; effacer() vide tout', () => {
  const { h } = ouvrir();
  h.noterVisite('https://vieux.fr', 'Vieux', 1000);
  h.noterVisite('https://neuf.fr', 'Neuf', 5000);
  h.noterVisite('https://mixte.fr', 'Mixte', 1000);
  h.noterVisite('https://mixte.fr', 'Mixte', 6000);
  h.effacer(4000);
  assert.deepStrictEqual(h.chercher('neuf'), []);
  assert.strictEqual(h.chercher('vieux').length, 1);
  const m = h.chercher('mixte')[0];
  assert.strictEqual(m.visites, 1);
  assert.strictEqual(m.derniere, 1000);
  h.effacer();
  assert.deepStrictEqual(h.chercher('vieux'), []);
  h.fermer();
});

test('recents : les visites de la plus récente à la plus ancienne, par pages', () => {
  const { h } = ouvrir();
  h.noterVisite('https://a.fr/', 'A', 1000);
  h.noterVisite('https://b.fr/', 'B', 2000);
  h.noterVisite('https://a.fr/', 'A', 3000);
  assert.deepStrictEqual(h.recents(2).map((r) => [r.url, r.quand]), [['https://a.fr/', 3000], ['https://b.fr/', 2000]]);
  assert.deepStrictEqual(h.recents(10, 2000).map((r) => r.quand), [1000]);
  h.fermer();
});

test('oublier : la page disparaît des visites et de la recherche', () => {
  const { h } = ouvrir();
  h.noterVisite('https://secret.fr/', 'Secret', 1000);
  h.noterVisite('https://autre.fr/', 'Autre', 2000);
  h.oublier('https://secret.fr/');
  assert.deepStrictEqual(h.recents().map((r) => r.url), ['https://autre.fr/']);
  assert.deepStrictEqual(h.chercher('secret'), []);
  h.fermer();
});
