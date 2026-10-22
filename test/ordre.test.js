const test = require('node:test');
const assert = require('node:assert');
const { entre } = require('../src/main/model/ordre');

test('entre(null, null) donne une clé non vide', () => {
  assert.ok(entre(null, null).length > 0);
});

test('entre(a, b) est strictement entre a et b', () => {
  const a = entre(null, null);
  const b = entre(a, null);
  const c = entre(null, a);
  assert.ok(a < b && c < a);
  const m = entre(c, b);
  assert.ok(c < m && m < b);
});

test('1000 insertions au même endroit restent strictement ordonnées', () => {
  // La longueur, elle, est bornée par le rééquilibrage de arbre.js (voir arbre.test.js).
  const bas = entre(null, null);
  const haut = entre(bas, null);
  let gauche = bas;
  for (let i = 0; i < 1000; i++) {
    const k = entre(gauche, haut);
    assert.ok(gauche < k && k < haut, `${gauche} < ${k} < ${haut}`);
    assert.notStrictEqual(k.at(-1), '0');
    gauche = k;
  }
  let droite = haut;
  for (let i = 0; i < 1000; i++) {
    const k = entre(bas, droite);
    assert.ok(bas < k && k < droite);
    droite = k;
  }
});

test('repartir(n) donne n clés croissantes et courtes', () => {
  const { repartir } = require('../src/main/model/ordre');
  const cles = repartir(500);
  assert.strictEqual(cles.length, 500);
  for (let i = 1; i < cles.length; i++) assert.ok(cles[i - 1] < cles[i]);
  assert.ok(cles.every((c) => c.length <= 3));
});

test('entre refuse a >= b', () => {
  assert.throws(() => entre('b', 'a'));
});
