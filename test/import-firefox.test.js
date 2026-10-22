const test = require('node:test');
const assert = require('node:assert');
const { profilParDefaut, versElectron } = require('../src/main/import-firefox-purs');

const MAINTENANT = Date.UTC(2026, 9, 22);
const ligne = (patch) => ({
  name: 'SID', value: 'v', host: '.google.com', path: '/', expiry: MAINTENANT + 86400e3,
  isSecure: 1, isHttpOnly: 1, sameSite: 0, ...patch
});

test('profil : installs.ini prime, sinon la section Default=1 de profiles.ini', () => {
  const profiles = '[Profile1]\nIsRelative=1\nPath=Profiles/b.default\nDefault=1\n\n[Profile0]\nPath=Profiles/a.default-release\n';
  assert.strictEqual(profilParDefaut('[Install1]\nDefault=Profiles/a.default-release\n', profiles), 'Profiles/a.default-release');
  assert.strictEqual(profilParDefaut('', profiles), 'Profiles/b.default');
  assert.strictEqual(profilParDefaut('', ''), null);
});

test('cookie de domaine : url https, domaine gardé, expiration en secondes', () => {
  const c = versElectron(ligne(), MAINTENANT);
  assert.strictEqual(c.url, 'https://google.com/');
  assert.strictEqual(c.domain, '.google.com');
  assert.strictEqual(c.expirationDate, Math.floor((MAINTENANT + 86400e3) / 1000));
  assert.strictEqual(c.sameSite, 'no_restriction');
  assert.strictEqual(c.httpOnly, true);
});

test('cookie d’hôte (__Host-) : sans domaine', () => {
  const c = versElectron(ligne({ name: '__Host-x', host: 'accounts.google.com' }), MAINTENANT);
  assert.strictEqual(c.domain, undefined);
  assert.strictEqual(c.url, 'https://accounts.google.com/');
});

test('SameSite=None sans Secure retombe sur non précisé ; 256 aussi', () => {
  assert.strictEqual(versElectron(ligne({ isSecure: 0 }), MAINTENANT).sameSite, 'unspecified');
  assert.strictEqual(versElectron(ligne({ sameSite: 256 }), MAINTENANT).sameSite, 'unspecified');
  assert.strictEqual(versElectron(ligne({ sameSite: 1 }), MAINTENANT).sameSite, 'lax');
});

test('expiré ou sans hôte : écarté ; expiration en secondes (ancien format) comprise', () => {
  assert.strictEqual(versElectron(ligne({ expiry: MAINTENANT - 1 }), MAINTENANT), null);
  assert.strictEqual(versElectron(ligne({ host: '' }), MAINTENANT), null);
  assert.ok(versElectron(ligne({ expiry: Math.floor(MAINTENANT / 1000) + 3600 }), MAINTENANT));
});
