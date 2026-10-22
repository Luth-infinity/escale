const test = require('node:test');
const assert = require('node:assert');
const { aEndormir, regrouperMeta } = require('../src/main/onglets-purs');

const MIN = 60e3;

test('aEndormir : au-delà du délai, jamais l’actif ni un onglet qui joue du son', () => {
  const t0 = 10_000 * MIN;
  const onglets = [
    { id: 'actif', derniereActivite: t0 - 60 * MIN },
    { id: 'son', derniereActivite: t0 - 60 * MIN },
    { id: 'vieux', derniereActivite: t0 - 21 * MIN },
    { id: 'recent', derniereActivite: t0 - 19 * MIN }
  ];
  const vivants = new Set(['actif', 'son', 'vieux', 'recent']);
  assert.deepStrictEqual(aEndormir(onglets, vivants, 'actif', t0, 20 * MIN, new Set(['son'])), ['vieux']);
});

test('aEndormir : ne propose que des onglets vivants, et rien si le délai vaut 0', () => {
  const t0 = 10_000 * MIN;
  const onglets = [{ id: 'a', derniereActivite: 0 }, { id: 'b', derniereActivite: 0 }];
  assert.deepStrictEqual(aEndormir(onglets, new Set(['b']), null, t0, 20 * MIN, new Set()), ['b']);
  assert.deepStrictEqual(aEndormir(onglets, new Set(['a', 'b']), null, t0, 0, new Set()), []);
});

test('regrouperMeta : 10 titres en 100 ms → une émission, avec le dernier titre', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const emis = [];
  const pousser = regrouperMeta(250, (id, patch) => emis.push([id, patch]));
  for (let i = 0; i < 10; i++) {
    pousser('o1', { titre: `T${i}` });
    t.mock.timers.tick(10);
  }
  assert.strictEqual(emis.length, 0);
  t.mock.timers.tick(250);
  assert.deepStrictEqual(emis, [['o1', { titre: 'T9' }]]);
});

test('regrouperMeta : les champs se fusionnent, et chaque onglet a sa fenêtre', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const emis = [];
  const pousser = regrouperMeta(250, (id, patch) => emis.push([id, patch]));
  pousser('a', { titre: 'A' });
  pousser('b', { url: 'https://b.fr' });
  pousser('a', { favicon: 'data:x' });
  t.mock.timers.tick(250);
  assert.deepStrictEqual(emis.sort(), [['a', { titre: 'A', favicon: 'data:x' }], ['b', { url: 'https://b.fr' }]]);
  pousser.vider('a');
  assert.strictEqual(emis.length, 2);
});
