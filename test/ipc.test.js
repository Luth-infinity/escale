const test = require('node:test');
const assert = require('node:assert');
const { estShell, urlShell } = require('../src/main/ipc-garde');

const SHELL = 'file:///Applications/Escale.app/Contents/Resources/app.asar/src/renderer/dist/index.html';
const frame = (url, principale = true) => ({ url, parent: principale ? null : {} });

test('accepte l’URL exacte du shell, frame principale', () => {
  assert.ok(estShell(frame(SHELL), SHELL));
  assert.ok(estShell(frame(SHELL + '#/reglages'), SHELL));
  assert.ok(estShell(frame('http://localhost:5273/'), 'http://localhost:5273/'));
});

test('refuse un site web, une sous-frame, un autre fichier, une frame absente', () => {
  assert.ok(!estShell(frame('https://exemple.com/'), SHELL));
  assert.ok(!estShell(frame(SHELL, false), SHELL));
  assert.ok(!estShell(frame('file:///etc/passwd'), SHELL));
  assert.ok(!estShell(frame(SHELL + '/../../x.html'), SHELL));
  assert.ok(!estShell(frame('http://localhost:5274/'), 'http://localhost:5273/'));
  assert.ok(!estShell(null, SHELL));
  assert.ok(!estShell(frame('chrome-extension://abc/popup.html'), SHELL));
});

test('l’app empaquetée charge toujours le shell compilé, même avec --dev', () => {
  const u = { dev: 'http://localhost:5373/', dist: SHELL };
  assert.strictEqual(urlShell({ ...u, empaquetee: true, argv: ['Escale', '--dev'] }), SHELL);
  assert.strictEqual(urlShell({ ...u, empaquetee: false, argv: ['electron', '.'] }), u.dev);
  assert.strictEqual(urlShell({ ...u, empaquetee: false, argv: ['electron', '.', '--shell-dist'] }), SHELL);
});
