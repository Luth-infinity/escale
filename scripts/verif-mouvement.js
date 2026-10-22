/* Outil de dev : pilote l'interface au clavier-souris et relève l'état à des instants précis. */
const fs = require('node:fs');
const { remplir } = require('./apercu');

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function verifMouvement(ctx) {
  try {
    await verifier(ctx);
  } catch (e) {
    console.log('✖ banc interrompu —', e.message);
    require('electron').app.exit(1);
  }
};

async function verifier({ fenetre, onglets, etat, agir, sortie }) {
  const res = [];
  const noter = (nom, ok, detail) => res.push({ nom, ok, detail });
  const shell = fenetre.webContents;
  remplir({ onglets, etat, agir });
  await attendre(5000);
  const vue = () => fenetre.contentView.children[0];

  // 1. Transition : la vue entrante reste masquée pendant le fondu, l'image est dans le shell.
  const jour = etat.lire().onglets.filter((o) => !o.epingle && o.espaceId === etat.lire().espaceActif);
  await onglets.assurerVue(jour[0].id);
  agir('onglet.activer', { id: jour[0].id });
  await attendre(60);
  const pendant = { visible: vue().getVisible(), images: await shell.executeJavaScript("document.querySelectorAll('#zone-page img').length") };
  fs.writeFileSync(`${sortie}-transition.png`, (await shell.capturePage()).toPNG());
  await attendre(300);
  const apres = { visible: vue().getVisible(), images: await shell.executeJavaScript("document.querySelectorAll('#zone-page img').length") };
  noter('transition : vue masquée puis révélée, images retirées', !pendant.visible && pendant.images >= 1 && apres.visible && apres.images === 0, JSON.stringify({ pendant, apres }));

  // 2. Glisser-déposer : « Example Domain » descendu sous « MDN ».
  const rect = (id) => shell.executeJavaScript(`(() => {
    const r = document.querySelector('[data-id="${id}"]').getBoundingClientRect(); return { x: r.x + 60, y: r.y + r.height / 2 };
  })()`);
  const ordreJour = () => etat.lire().onglets.filter((o) => !o.epingle && o.espaceId === etat.lire().espaceActif)
    .sort((a, b) => (a.ordre < b.ordre ? -1 : 1)).map((o) => o.titre || o.url);
  const avantDnd = ordreJour();
  const idDe = (debut) => etat.lire().onglets.find((o) => o.url.startsWith(debut)).id;
  const a = await rect(idDe('https://example.com'));
  const b = await rect(idDe('https://developer.mozilla.org'));
  shell.sendInputEvent({ type: 'mouseDown', x: a.x, y: a.y, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 12; i++) {
    shell.sendInputEvent({ type: 'mouseMove', x: a.x, y: a.y + ((b.y + 12 - a.y) * i) / 12, button: 'left' });
    await attendre(16);
  }
  const fantome = await shell.executeJavaScript("!!document.querySelector('aside .pointer-events-none.z-10')");
  shell.sendInputEvent({ type: 'mouseUp', x: a.x, y: b.y + 12, button: 'left', clickCount: 1 });
  await attendre(400);
  const apresDnd = ordreJour();
  noter('glisser-déposer : l’onglet change de place', fantome && JSON.stringify(avantDnd) !== JSON.stringify(apresDnd), JSON.stringify({ fantome, avantDnd, apresDnd }));

  // 3. Balayage à deux doigts : passage à l'espace suivant.
  const espAvant = etat.lire().espaceActif;
  for (let i = 0; i < 10; i++) {
    shell.sendInputEvent({ type: 'mouseWheel', x: 120, y: 400, deltaX: -20, deltaY: 0, hasPreciseScrollingDeltas: true });
    await attendre(16);
  }
  await attendre(400);
  const espApres = etat.lire().espaceActif;
  noter('balayage : changement d’espace', espApres !== espAvant, `${espAvant} → ${espApres}`);
  agir('espace.activer', { id: espAvant });
  await attendre(400);

  // 4. Repli de la barre : la page suit pendant l'animation.
  const xs = [];
  agir('barre.replier', { oui: true });
  for (let i = 0; i < 12; i++) {
    await attendre(25);
    xs.push(vue().getBounds().x);
  }
  await attendre(300);
  const largeur = await shell.executeJavaScript("document.querySelector('aside').getBoundingClientRect().width");
  const intermediaires = new Set(xs).size;
  noter('repli : la page suit en continu et la barre fait 56 px', largeur === 56 && intermediaires >= 4 && vue().getBounds().x < 70, JSON.stringify({ largeur, xs }));
  fs.writeFileSync(`${sortie}-rail.png`, (await shell.capturePage()).toPNG());
  agir('barre.replier', { oui: false });
  await attendre(500);

  // 5. Barre de commande : latence à l'ouverture, saisie, Entrée → nouvel onglet.
  const ipc = require('../src/main/ipc');
  let latence = null;
  const ecoute = (e) => {
    const m = /barre de commande : (\d+) ms/.exec(e.message || '');
    if (m) latence = Number(m[1]);
  };
  shell.on('console-message', ecoute);
  ipc.emettre({ type: 'ui:commande', nom: 'nouvel-onglet', t: Date.now() });
  await attendre(400);
  for (const c of 'github.com') {
    shell.sendInputEvent({ type: 'char', keyCode: c });
    await attendre(20);
  }
  await attendre(400);
  const premier = await shell.executeJavaScript("document.querySelector('[role=option]')?.textContent || ''");
  fs.writeFileSync(`${sortie}-commande.png`, (await shell.capturePage()).toPNG());
  const nAvant = etat.lire().onglets.length;
  shell.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
  shell.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
  await attendre(600);
  shell.off('console-message', ecoute);
  const nouvel = etat.lire().onglets.find((o) => o.id === etat.lire().ongletActif);
  const ferme = await shell.executeJavaScript("!document.querySelector('[role=dialog]')");
  noter(
    'barre de commande : ouverte en < 100 ms, « github.com » ouvert dans un nouvel onglet',
    latence !== null && latence < 100 && etat.lire().onglets.length === nAvant + 1 && nouvel?.url.startsWith('https://github.com') && ferme && vue().getVisible(),
    JSON.stringify({ latence, premier, url: nouvel?.url, ferme })
  );

  // 6. Rechercher dans la page : la barre se loge au-dessus, la page descend de 40 px.
  const yAvant = vue().getBounds().y;
  ipc.emettre({ type: 'ui:commande', nom: 'chercher', t: Date.now() });
  const releves = [];
  for (let i = 0; i < 12; i++) {
    await attendre(50);
    releves.push(await shell.executeJavaScript("(() => { const z = document.getElementById('zone-page'); const b = z.previousElementSibling; return b ? Math.round(b.getBoundingClientRect().height) : -1; })()"));
  }
  const yApres = vue().getBounds().y;
  noter('rechercher : la page descend sous la barre', yApres - yAvant === 40, `${yAvant} → ${yApres}, hauteurs ${releves.join('/')}`);

  for (const r of res) console.log(`${r.ok ? '✔' : '✖'} ${r.nom} — ${r.detail}`);
  require('electron').app.exit(res.every((r) => r.ok) ? 0 : 1);
}
