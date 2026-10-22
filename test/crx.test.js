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

// Un zip minimal (méthode « stocké ») : [{ nom, contenu, mode?, declare? }].
function zip(entrees) {
  const locaux = [];
  const centraux = [];
  let decalage = 0;
  for (const e of entrees) {
    const nom = Buffer.from(e.nom);
    const data = Buffer.from(e.contenu ?? 'x');
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0);
    l.writeUInt16LE(e.methode ?? 0, 8);
    l.writeUInt32LE(data.length, 18);
    l.writeUInt32LE(e.declare ?? data.length, 22);
    l.writeUInt16LE(nom.length, 26);
    locaux.push(l, nom, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE((3 << 8) | 20, 4); // créé sous Unix
    c.writeUInt16LE(e.methode ?? 0, 10);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(e.declare ?? data.length, 24);
    c.writeUInt16LE(nom.length, 28);
    c.writeUInt32LE(((e.mode ?? 0o100644) << 16) >>> 0, 38);
    c.writeUInt32LE(decalage, 42);
    centraux.push(c, nom);
    decalage += 30 + nom.length + data.length;
  }
  const cd = Buffer.concat(centraux);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(cd.length, 12);
  fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, cd, fin]);
}

test('inspecterZip accepte l’archive d’un vrai CRX et un zip sain', () => {
  const { archive } = crx.decouper(vrai());
  assert.deepStrictEqual(crx.inspecterZip(archive), { ok: true });
  assert.deepStrictEqual(crx.inspecterZip(zip([{ nom: 'manifest.json' }, { nom: 'js/a.js' }])), { ok: true });
});

test('inspecterZip refuse traversée, chemin absolu, lien symbolique, SUID, doublon, bombe', () => {
  const cas = {
    traversee: [{ nom: '../../.ssh/authorized_keys' }],
    absolu: [{ nom: '/etc/hosts' }],
    windows: [{ nom: 'C:\\Windows\\x.dll' }],
    lien: [{ nom: 'lien', mode: 0o120777, contenu: '/etc/passwd' }],
    suid: [{ nom: 'outil', mode: 0o104755 }],
    doublon: [{ nom: 'a.js' }, { nom: 'A.js' }],
    bombe: [{ nom: 'gros', declare: 0x7fffffff }],
    tailleNulle: [{ nom: 'z', methode: 8, contenu: 'x'.repeat(64), declare: 0 }]
  };
  for (const [nom, entrees] of Object.entries(cas)) {
    const r = crx.inspecterZip(zip(entrees));
    assert.strictEqual(r.ok, false, nom);
  }
  assert.strictEqual(crx.inspecterZip(Buffer.from('pas un zip')).ok, false);
});
