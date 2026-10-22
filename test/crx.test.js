const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crx = require('../src/main/crx');

const DARK_READER = 'eimadpbcbfnmbkopoojfekhnkhdbieeh';
const vrai = () => fs.readFileSync(path.join(__dirname, 'fixtures/darkreader.crx'));

test('accepte un vrai CRX3 du Web Store et en donne l’identifiant', () => {
  assert.deepStrictEqual(crx.verifier(vrai()), { ok: true, id: DARK_READER });
  assert.strictEqual(crx.verifier(vrai(), { id: DARK_READER }).ok, true);
});

test('refuse un identifiant attendu différent', () => {
  const r = crx.verifier(vrai(), { id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /identifiant/);
});

test('refuse un zip nu, un CRX2 et un fichier tronqué', () => {
  assert.strictEqual(crx.verifier(Buffer.from('PK\x03\x04 pas un crx')).ok, false);
  const crx2 = Buffer.alloc(16);
  crx2.write('Cr24', 0);
  crx2.writeUInt32LE(2, 4);
  assert.match(crx.verifier(crx2).raison, /version/);
  assert.strictEqual(crx.verifier(vrai().subarray(0, 40)).ok, false);
  assert.strictEqual(crx.verifier(Buffer.alloc(0)).ok, false);
});

test('refuse un CRX3 dont un octet du zip a été modifié', () => {
  const b = Buffer.from(vrai());
  b[b.length - 100] ^= 0xff;
  const r = crx.verifier(b);
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /signature/);
});

test('refuse un CRX3 sans la preuve du Web Store', () => {
  // On retire la preuve de l'éditeur : la preuve du développeur seule ne suffit pas.
  const b = crx.retirerPreuve(vrai(), crx.EMPREINTE_WEB_STORE);
  const r = crx.verifier(b);
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /Web Store/);
});
