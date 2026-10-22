const test = require('node:test');
const assert = require('node:assert');
const { ACTIONS } = require('../src/main/actions');
const { valider } = require('../src/main/valider');

const ATTENDUES = [
  'onglet.ouvrir', 'onglet.fermer', 'onglet.restaurer', 'onglet.activer', 'onglet.deplacer', 'onglet.epingler',
  'onglet.dupliquer', 'onglet.muet', 'dossier.creer', 'dossier.renommer', 'dossier.replier', 'dossier.supprimer',
  'dossier.teinte', 'espace.creer', 'espace.activer', 'espace.modifier', 'espace.supprimer', 'nav.precedent',
  'nav.suivant', 'nav.recharger', 'nav.aller', 'page.chercher', 'page.zoom', 'layout.zone', 'layout.overlay', 'barre.replier',
  'commande.resoudre', 'commande.ouvrir', 'page.capture'
];

test('chaque action attendue est déclarée, avec un schéma objet et une fonction', () => {
  for (const nom of ATTENDUES) {
    const a = ACTIONS[nom];
    assert.ok(a, `${nom} manquante`);
    assert.strictEqual(a.schema.type, 'objet', nom);
    assert.strictEqual(typeof a.fn, 'function', nom);
  }
});

test('les schémas refusent les charges hostiles', () => {
  const id = '0f1e2d3c-4b5a-4968-8776-655443322110';
  assert.throws(() => valider(ACTIONS['onglet.fermer'].schema, { id: 'x'.repeat(100) }), /payload-invalide/);
  assert.throws(() => valider(ACTIONS['onglet.ouvrir'].schema, { url: 'https://a.fr/' + 'x'.repeat(9000) }), /payload-invalide/);
  assert.throws(() => valider(ACTIONS['dossier.teinte'].schema, { id, teinte: 'red; background:url(x)' }), /payload-invalide/);
  assert.throws(() => valider(ACTIONS['onglet.deplacer'].schema, { id, type: 'espace' }), /payload-invalide/);
  assert.throws(() => valider(ACTIONS['page.zoom'].schema, { sens: 'beaucoup' }), /payload-invalide/);
  assert.doesNotThrow(() => valider(ACTIONS['dossier.teinte'].schema, { id, teinte: '#3a7f6b' }));
  assert.doesNotThrow(() => valider(ACTIONS['dossier.teinte'].schema, { id, teinte: null }));
  assert.doesNotThrow(() => valider(ACTIONS['layout.zone'].schema, { x: 248, y: 8, width: 1024, height: 800 }));
});

test('onglet.fermer puis onglet.restaurer rouvre la même adresse dans le même espace', () => {
  const appels = [];
  const ouvert = { id: 'o1', espaceId: 'e1', url: 'https://a.fr/' };
  const ctx = {
    etat: {
      lire: () => ({ espaces: [{ id: 'e1' }], onglets: [ouvert], espaceActif: 'e1' }),
      appliquer: (op, ...args) => appels.push([op, ...args])
    },
    onglets: { ouvrir: (...args) => appels.push(['ouvrir', ...args]) },
    fermes: []
  };
  ACTIONS['onglet.fermer'].fn(ctx, { id: 'o1' });
  ACTIONS['onglet.restaurer'].fn(ctx, {});
  assert.deepStrictEqual(appels, [['fermerOnglet', 'o1'], ['ouvrir', 'e1', 'https://a.fr/', { actif: true }]]);
  ACTIONS['onglet.restaurer'].fn(ctx, {});
  assert.strictEqual(appels.length, 2);
});

test('la pile des onglets fermés garde les 25 derniers', () => {
  const ctx = {
    etat: { lire: () => ({ espaces: [], onglets: Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, espaceId: 'e', url: `u${i}` })) }), appliquer: () => {} },
    fermes: []
  };
  for (let i = 0; i < 30; i++) ACTIONS['onglet.fermer'].fn(ctx, { id: `o${i}` });
  assert.strictEqual(ctx.fermes.length, 25);
  assert.strictEqual(ctx.fermes.at(-1).url, 'u29');
});
