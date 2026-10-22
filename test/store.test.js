const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const store = require('../src/main/store');
const A = require('../src/main/model/arbre');

const dossierTemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'escale-store-'));

test('sans fichier : un état neuf', () => {
  const etat = store.charger(dossierTemp());
  assert.strictEqual(etat.version, 1);
  assert.strictEqual(etat.espaces.length, 1);
});

test('aller-retour : ce qui est écrit est relu, en 0600', () => {
  const dir = dossierTemp();
  const etat = A.ouvrirOnglet(A.creerEtat(), { espaceId: A.creerEtat().espaceActif, url: 'https://a.fr' }).etat;
  store.ecrireMaintenant(dir, etat);
  assert.deepStrictEqual(store.charger(dir), etat);
  assert.strictEqual(fs.statSync(path.join(dir, 'escale.json')).mode & 0o777, 0o600);
});

test('JSON tronqué : renommé en .corrompu-*, et repli sur le dernier état valide', () => {
  const dir = dossierTemp();
  const bon = A.creerEtat();
  store.ecrireMaintenant(dir, bon);
  store.ecrireMaintenant(dir, A.creerEtat());
  fs.writeFileSync(path.join(dir, 'escale.json'), '{"version":1,"espa');
  const etat = store.charger(dir);
  assert.deepStrictEqual(etat, bon);
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('escale.json.corrompu-')));
});

test('version inconnue ou forme invalide : état neuf, fichier mis de côté', () => {
  const dir = dossierTemp();
  fs.writeFileSync(path.join(dir, 'escale.json'), JSON.stringify({ version: 99, espaces: [] }));
  const etat = store.charger(dir);
  assert.strictEqual(etat.version, 1);
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('escale.json.corrompu-')));
  fs.writeFileSync(path.join(dir, 'escale.json'), JSON.stringify({ version: 1, espaces: [] }));
  assert.strictEqual(store.charger(dir).espaces.length, 1);
});

test('deux planifierEcriture à 10 ms d’écart : une seule écriture, 1 s après', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renommages = t.mock.method(fs, 'renameSync');
  const dir = dossierTemp();
  store.planifierEcriture(dir, A.creerEtat());
  t.mock.timers.tick(10);
  const dernier = A.creerEtat();
  store.planifierEcriture(dir, dernier);
  t.mock.timers.tick(999);
  assert.strictEqual(renommages.mock.calls.filter((c) => c.arguments[1].endsWith('escale.json')).length, 0);
  t.mock.timers.tick(1);
  assert.strictEqual(renommages.mock.calls.filter((c) => c.arguments[1].endsWith('escale.json')).length, 1);
  assert.deepStrictEqual(store.charger(dir), dernier);
});
