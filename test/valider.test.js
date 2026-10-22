const test = require('node:test');
const assert = require('node:assert');
const { valider } = require('../src/main/valider');

const schema = {
  type: 'objet',
  champs: {
    url: { type: 'string', max: 10 },
    zone: { type: 'enum', valeurs: ['jour', 'epingles'] },
    n: { type: 'number', optionnel: true },
    ok: { type: 'boolean', optionnel: true },
    ids: { type: 'tableau', max: 2, elements: { type: 'string', max: 5 }, optionnel: true }
  }
};

test('accepte une valeur conforme et la renvoie', () => {
  const v = { url: 'https://a', zone: 'jour', ids: ['a', 'b'] };
  assert.strictEqual(valider(schema, v), v);
});

test('refuse chaîne trop longue, clé inconnue, enum hors liste, champ manquant', () => {
  assert.throws(() => valider(schema, { url: 'x'.repeat(11), zone: 'jour' }), /payload-invalide: url/);
  assert.throws(() => valider(schema, { url: 'a', zone: 'jour', pirate: 1 }), /payload-invalide: pirate/);
  assert.throws(() => valider(schema, { url: 'a', zone: 'nimporte' }), /payload-invalide: zone/);
  assert.throws(() => valider(schema, { zone: 'jour' }), /payload-invalide: url/);
});

test('refuse les mauvais types, NaN, tableaux trop longs et éléments invalides', () => {
  assert.throws(() => valider(schema, { url: 1, zone: 'jour' }), /payload-invalide: url/);
  assert.throws(() => valider(schema, { url: 'a', zone: 'jour', n: NaN }), /payload-invalide: n/);
  assert.throws(() => valider(schema, { url: 'a', zone: 'jour', ids: ['a', 'b', 'c'] }), /payload-invalide: ids/);
  assert.throws(() => valider(schema, { url: 'a', zone: 'jour', ids: ['trop-long'] }), /payload-invalide: ids\.0/);
  assert.throws(() => valider(schema, null), /payload-invalide/);
  assert.throws(() => valider(schema, ['a']), /payload-invalide/);
});

test('null accepté seulement si le schéma le dit', () => {
  assert.strictEqual(valider({ type: 'string', nul: true }, null), null);
  assert.throws(() => valider({ type: 'string' }, null), /payload-invalide/);
});
