const test = require('node:test');
const assert = require('node:assert');
const { resoudre, versUrl } = require('../src/main/commande');

const etat = {
  espaceActif: 'e',
  onglets: [
    { id: 'o1', espaceId: 'e', epingle: false, url: 'https://github.com/luth/escale', titre: 'Escale · GitHub' },
    { id: 'o2', espaceId: 'e', epingle: true, url: 'https://linear.app/', titre: 'Linear' },
    { id: 'o3', espaceId: 'autre', epingle: false, url: 'https://exemple.fr/', titre: 'Exemple' }
  ]
};
const historique = {
  chercher: (texte) =>
    [{ url: 'https://gitlab.com/x', titre: 'GitLab', visites: 3, derniere: 1 }, { url: 'https://github.com/luth/escale', titre: 'Escale · GitHub', visites: 9, derniere: 2 }]
      .filter((h) => (h.url + h.titre).toLowerCase().includes(texte.toLowerCase()))
};

test('versUrl : adresses, localhost, schémas ; le reste n’est pas une adresse', () => {
  assert.strictEqual(versUrl('github.com'), 'https://github.com/');
  assert.strictEqual(versUrl('docs.github.com/fr/get-started'), 'https://docs.github.com/fr/get-started');
  assert.strictEqual(versUrl('http://vieux.fr'), 'http://vieux.fr/');
  assert.strictEqual(versUrl('localhost:3000'), 'http://localhost:3000/');
  assert.strictEqual(versUrl('192.168.1.1'), 'http://192.168.1.1/');
  assert.strictEqual(versUrl('météo paris'), null);
  assert.strictEqual(versUrl('node.js tutoriel'), null);
  assert.strictEqual(versUrl('javascript:alert(1)'), null);
  assert.strictEqual(versUrl('file:///etc/passwd'), null);
});

test('« github.com » : l’URL directe en premier', () => {
  const r = resoudre('github.com', etat, historique);
  assert.deepStrictEqual(r[0], { type: 'url', titre: 'github.com', url: 'https://github.com/' });
});

test('« git » avec un onglet GitHub ouvert : l’onglet d’abord, puis l’historique, puis la recherche', () => {
  const r = resoudre('git', etat, historique);
  assert.deepStrictEqual(r.map((x) => x.type), ['onglet', 'historique', 'recherche']);
  assert.strictEqual(r[0].id, 'o1');
  // L'historique ne répète pas un onglet déjà ouvert.
  assert.strictEqual(r[1].url, 'https://gitlab.com/x');
  assert.strictEqual(r[2].url, 'https://www.google.com/search?q=git');
});

test('les épinglés sont proposés, avec leur type ; les autres espaces aussi, après', () => {
  assert.deepStrictEqual(resoudre('linear', etat, historique).map((x) => [x.type, x.id]).slice(0, 1), [['epingle', 'o2']]);
  const r = resoudre('exemple', etat, historique);
  assert.strictEqual(r[0].id, 'o3');
});

test('raccourcis de recherche : yt, gh, w, g', () => {
  assert.deepStrictEqual(resoudre('yt chat qui saute', etat, historique)[0], {
    type: 'recherche', titre: 'Rechercher « chat qui saute » sur YouTube', url: 'https://www.youtube.com/results?search_query=chat%20qui%20saute'
  });
  assert.strictEqual(resoudre('gh escale', etat, historique)[0].url, 'https://github.com/search?q=escale');
  assert.strictEqual(resoudre('w Escale', etat, historique)[0].url, 'https://fr.wikipedia.org/w/index.php?search=Escale');
  assert.strictEqual(resoudre('g météo', etat, historique)[0].url, 'https://www.google.com/search?q=m%C3%A9t%C3%A9o');
});

test('moteur réglable ; texte vide : rien ; huit résultats au plus ; accents ignorés', () => {
  assert.strictEqual(resoudre('chat', etat, historique, 'duckduckgo').at(-1).url, 'https://duckduckgo.com/?q=chat');
  assert.deepStrictEqual(resoudre('   ', etat, historique), []);
  const beaucoup = { espaceActif: 'e', onglets: Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, espaceId: 'e', epingle: false, url: `https://site${i}.fr/`, titre: `Site ${i}` })) };
  assert.strictEqual(resoudre('site', beaucoup, { chercher: () => [] }).length, 8);
  const accent = { espaceActif: 'e', onglets: [{ id: 'a', espaceId: 'e', epingle: false, url: 'https://meteo.fr/', titre: 'Météo-France' }] };
  assert.strictEqual(resoudre('meteo france', accent, { chercher: () => [] })[0].id, 'a');
});
