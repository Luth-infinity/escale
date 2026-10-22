const test = require('node:test');
const assert = require('node:assert');
const { estShell } = require('../src/main/ipc-garde');

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
