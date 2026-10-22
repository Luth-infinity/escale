const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/main/permissions-ext');

test('<all_urls> et équivalents : toutes vos données sur tous les sites', () => {
  for (const hote of ['<all_urls>', '*://*/*', 'https://*/*']) {
    assert.ok(P.decrire({ manifest_version: 3, host_permissions: [hote] }).includes('Lire et modifier toutes vos données sur tous les sites'));
  }
  // Un script de contenu sur tous les sites compte autant qu'une permission d'hôte.
  const cs = { manifest_version: 3, content_scripts: [{ matches: ['<all_urls>'], js: ['a.js'] }] };
  assert.ok(P.decrire(cs).includes('Lire et modifier toutes vos données sur tous les sites'));
});

test('sites précis : listés, trois au plus', () => {
  const d = P.decrire({ manifest_version: 3, host_permissions: ['https://a.fr/*', 'https://*.b.com/*', 'https://c.org/x', 'https://d.net/*'] });
  assert.ok(d.includes('Lire et modifier vos données sur 4 sites : a.fr, b.com, c.org…'), d.join(' | '));
  const un = P.decrire({ manifest_version: 3, host_permissions: ['https://a.fr/*'] });
  assert.ok(un.includes('Lire et modifier vos données sur a.fr'), un.join(' | '));
});

test('MV2 : les hôtes peuvent être dans permissions ; phrases sans doublon', () => {
  const d = P.decrire({ manifest_version: 2, permissions: ['tabs', 'history', '<all_urls>', 'clipboardRead'] });
  assert.deepStrictEqual(d, [
    'Lire et modifier toutes vos données sur tous les sites',
    'Lire votre historique de navigation',
    'Lire les données que vous copiez et collez'
  ]);
});

test('aucune permission sensible : liste vide', () => {
  assert.deepStrictEqual(P.decrire({ manifest_version: 3, permissions: ['storage', 'alarms'] }), []);
});

test('manquantes : les API qu’Escale ne fournit pas', () => {
  const m = P.manquantes({ permissions: ['nativeMessaging', 'storage', 'declarativeNetRequest', 'enterprise.platformKeys', 'identity'] });
  assert.deepStrictEqual(m, ['nativeMessaging', 'declarativeNetRequest', 'enterprise.platformKeys', 'identity']);
  assert.deepStrictEqual(P.manquantes({ optional_permissions: ['downloads'] }), ['downloads']);
  assert.deepStrictEqual(P.manquantes({}), []);
});
