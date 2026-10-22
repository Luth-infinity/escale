/* Mesures des cibles de performance (spec §5), lancées par scripts/mesures.js. */
const { app } = require('electron');

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function mesures({ fenetre, onglets, etat, ipc, debut }) {
  const shell = fenetre.webContents;
  const r = {};

  // 1. Barre latérale à l'écran, depuis « app prête ».
  for (;;) {
    const ok = await shell.executeJavaScript("!!document.querySelector('aside')").catch(() => false);
    if (ok) break;
    await attendre(5);
  }
  r.barreLateraleMs = Math.round(performance.now() - debut);

  // 2. Cmd+T : de l'émission de la commande à la première image de la barre.
  const latences = [];
  const ecoute = (e) => {
    const m = /barre de commande : (\d+) ms/.exec(e.message || '');
    if (m) latences.push(Number(m[1]));
  };
  shell.on('console-message', ecoute);
  for (let i = 0; i < 5; i++) {
    ipc.emettre({ type: 'ui:commande', nom: 'nouvel-onglet', t: Date.now() });
    await attendre(300);
    shell.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    shell.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await attendre(300);
  }
  shell.off('console-message', ecoute);
  r.cmdTMs = Math.max(...latences);

  // 3. IPC au repos avec 10 onglets chargés.
  const esp = etat.lire().espaceActif;
  for (let i = 0; i < 10; i++) onglets.ouvrir(esp, `https://example.com/?repos=${i}`, { actif: i === 9 });
  await attendre(8000);
  let octets = 0;
  const envoyer = shell.send.bind(shell);
  shell.send = (canal, ...args) => {
    octets += Buffer.byteLength(JSON.stringify(args));
    return envoyer(canal, ...args);
  };
  await attendre(10_000);
  shell.send = envoyer;
  r.ipcReposKoParS = +(octets / 1024 / 10).toFixed(2);

  // 4. Mémoire : 30 onglets dont 5 vivants.
  for (let i = 10; i < 30; i++) onglets.ouvrir(esp, `https://example.com/?memoire=${i}`, { actif: false });
  await attendre(8000);
  const vivants = onglets.vivants().filter((id) => id !== onglets.courantId());
  for (const id of vivants.slice(4)) onglets.endormir(id);
  await attendre(3000);
  r.vivants = onglets.vivants().length;
  r.memoireMo = Math.round(app.getAppMetrics().reduce((s, m) => s + m.memory.workingSetSize, 0) / 1024);

  const cibles = { barreLateraleMs: 500, cmdTMs: 100, ipcReposKoParS: 2, memoireMo: 1024 };
  const echecs = Object.entries(cibles).filter(([k, max]) => !(r[k] < max));
  process.stdout.write(`\nMESURES ${JSON.stringify({ ...r, cibles, echecs: echecs.map(([k]) => k) })}\n`);
  app.exit(echecs.length ? 1 : 0);
};
