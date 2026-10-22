const test = require('node:test');
const assert = require('node:assert');
const { versChrome } = require('../src/main/webrequest-ext');

const principal = { frameTreeNodeId: 2, parent: null };
const iframe = { frameTreeNodeId: 5, parent: principal };
const petite = { frameTreeNodeId: 9, parent: iframe };
const req = (resourceType, frame) => ({ id: 7, url: 'https://a.fr/x', method: 'GET', resourceType, timestamp: 1, webContentsId: 3, frame });

test('numérote les cadres comme Chrome : 0 pour le principal, -1 au-dessus', () => {
  assert.deepStrictEqual(
    [versChrome(req('mainFrame', principal), true)].map((d) => [d.frameId, d.parentFrameId, d.type, d.tabId]),
    [[0, -1, 'main_frame', 3]]
  );
  const s = versChrome(req('script', iframe), true);
  assert.deepStrictEqual([s.frameId, s.parentFrameId], [5, 0]);
  const p = versChrome(req('xhr', petite), true);
  assert.deepStrictEqual([p.frameId, p.parentFrameId, p.type, p.requestId], [9, 5, 'xmlhttprequest', '7']);
});

test('une requête sans onglet ni cadre (service worker) part en -1', () => {
  const d = versChrome(req('other', null), false);
  assert.deepStrictEqual([d.tabId, d.frameId, d.parentFrameId], [-1, -1, -1]);
});

test('un cadre détruit ne fait pas tomber le relais', () => {
  const mort = { get parent() { throw new Error('détruit'); }, frameTreeNodeId: 4 };
  const d = versChrome(req('image', mort), true);
  assert.deepStrictEqual([d.frameId, d.parentFrameId], [-1, -1]);
});
