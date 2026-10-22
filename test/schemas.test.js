const test = require('node:test');
const assert = require('node:assert');
const { politiqueSchema, versHttps } = require('../src/main/schemas');

test('politiqueSchema : web, interne, externe sur confirmation, bloqué', () => {
  assert.strictEqual(politiqueSchema('https://a.fr'), 'web');
  assert.strictEqual(politiqueSchema('http://a.fr'), 'web');
  assert.strictEqual(politiqueSchema('about:blank'), 'web');
  assert.strictEqual(politiqueSchema('data:text/html,x'), 'web');
  assert.strictEqual(politiqueSchema('blob:https://a.fr/1'), 'web');
  assert.strictEqual(politiqueSchema('chrome-extension://abc/p.html'), 'web');
  assert.strictEqual(politiqueSchema('escale://http?url=x'), 'interne');
  assert.strictEqual(politiqueSchema('mailto:a@b.fr'), 'externe');
  assert.strictEqual(politiqueSchema('zoommtg://zoom.us/join'), 'externe');
  for (const u of ['file:///etc/passwd', 'ms-msdt:/id', 'search-ms:query=x', 'javascript:alert(1)', 'vbscript:x', 'ms-officecmd:x', 'smb://h/x']) {
    assert.strictEqual(politiqueSchema(u), 'bloque', u);
  }
  assert.strictEqual(politiqueSchema('pas une url'), 'bloque');
});

test('versHttps : http devient https, sauf hôtes locaux et exceptions', () => {
  assert.strictEqual(versHttps('http://a.fr/x?y=1#z', new Set()), 'https://a.fr/x?y=1#z');
  assert.strictEqual(versHttps('https://a.fr/', new Set()), null);
  for (const u of ['http://localhost:3000/', 'http://127.0.0.1/', 'http://[::1]/', 'http://machine.local/', 'http://app.test/', 'http://192.168.1.10/']) {
    assert.strictEqual(versHttps(u, new Set()), null, u);
  }
  assert.strictEqual(versHttps('http://vieux.fr/', new Set(['vieux.fr'])), null);
  assert.strictEqual(versHttps('http://a.fr:8080/', new Set()), 'https://a.fr:8080/');
});
