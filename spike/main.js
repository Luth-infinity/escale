// Spike jetable : extensions, capture et coins arrondis sur Electron 41.
// Lance : npx electron .   — écrit ses résultats dans resultats.json puis quitte.
const { app, BaseWindow, WebContentsView, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { ElectronChromeExtensions } = require('electron-chrome-extensions');
const { installChromeWebStore, installExtension } = require('electron-chrome-web-store');

const EXT = {
  ublock: 'ddkjiahejlhfcafbddmgiahcphecmpfh',
  bitwarden: 'nngceckbapebfimnlniiiahkandclblb',
  darkreader: 'eimadpbcbfnmbkopoojfekhnkhdbieeh'
};
const res = { electron: process.versions.electron, chrome: process.versions.chrome, extensions: {}, erreursSW: [] };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const charger = (wc, url) => wc.loadURL(url).catch((e) => { throw new Error(`${url}: ${e.message}`); });

app.whenReady().then(async () => {
  const ses = session.fromPartition('persist:spike');
  const extensions = new ElectronChromeExtensions({ license: 'GPL-3.0', session: ses });
  await installChromeWebStore({ session: ses, extensionsPath: path.join(app.getPath('userData'), 'ext') });
  ses.serviceWorkers.on('console-message', (_e, d) => {
    if (d.level === 'error' || d.level === 3) res.erreursSW.push(String(d.message).slice(0, 200));
  });

  const win = new BaseWindow({ width: 1440, height: 960 });
  const shell = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'shell-preload.js'), sandbox: true } });
  win.contentView.addChildView(shell);
  shell.setBounds({ x: 0, y: 0, width: 1440, height: 960 });
  const view = new WebContentsView({ webPreferences: { session: ses, sandbox: true } });
  win.contentView.addChildView(view);
  view.setBounds({ x: 8, y: 52, width: 1424, height: 900 });
  extensions.addTab(view.webContents, win);
  extensions.selectTab(view.webContents);

  // 1. Installation
  for (const [nom, id] of Object.entries(EXT)) {
    const r = (res.extensions[nom] = { id });
    try {
      const ext = await installExtension(id, { session: ses });
      r.installee = true;
      r.version = ext.manifest.version;
      r.mv = ext.manifest.manifest_version;
      r.permissions = ext.manifest.permissions || [];
      r.popup = (ext.manifest.action || ext.manifest.browser_action || {}).default_popup || null;
    } catch (e) {
      r.installee = false;
      r.erreur = e.message;
    }
  }
  await attendre(4000); // laisser démarrer les service workers

  // 2. uBlock Origin Lite : une requête vers une régie est-elle bloquée ?
  await charger(view.webContents, 'https://example.com/');
  await attendre(1500);
  res.extensions.ublock.requeteRegieBloquee = await view.webContents.executeJavaScript(
    `fetch('https://securepubads.g.doubleclick.net/tag/js/gpt.js',{mode:'no-cors'}).then(()=>false,()=>true)`
  );
  res.declarativeNetRequest = typeof ses.extensions !== 'undefined';

  // 3. Dark Reader : le fond de example.com est-il devenu sombre ?
  await attendre(2000);
  res.extensions.darkreader.fond = await view.webContents.executeJavaScript(
    `getComputedStyle(document.documentElement).backgroundColor + ' | ' + !!document.querySelector('style.darkreader')`
  );

  // 4. Popups : la page de popup de chaque extension se rend-elle sans erreur ?
  for (const [nom, r] of Object.entries(res.extensions)) {
    if (!r.installee || !r.popup) continue;
    const p = new WebContentsView({ webPreferences: { session: ses } });
    const erreurs = [];
    p.webContents.on('console-message', (e) => { if (e.level === 'error') erreurs.push(String(e.message).slice(0, 160)); });
    try {
      await charger(p.webContents, `chrome-extension://${r.id}/${r.popup}`);
      await attendre(2500);
      r.popupTexte = (await p.webContents.executeJavaScript('document.body.innerText')).trim().slice(0, 120);
    } catch (e) { r.popupErreur = e.message; }
    r.popupErreursConsole = erreurs.slice(0, 5);
    p.webContents.close();
  }

  // 5. API chrome.* présentes dans le service worker d'une extension (Bitwarden)
  const api = ['tabs', 'windows', 'contextMenus', 'cookies', 'notifications', 'downloads', 'permissions', 'identity', 'offscreen', 'declarativeNetRequest', 'storage', 'alarms', 'scripting', 'webNavigation', 'action', 'runtime'];
  const bg = new WebContentsView({ webPreferences: { session: ses } });
  try {
    await charger(bg.webContents, `chrome-extension://${EXT.bitwarden}/popup/index.html`);
    res.apiDansUnePageExtension = await bg.webContents.executeJavaScript(
      `(${JSON.stringify(api)}).reduce((o,k)=>(o[k]=!!(chrome&&chrome[k]),o),{})`
    );
  } catch (e) { res.apiDansUnePageExtension = e.message; }
  bg.webContents.close();

  // 6. Capture : 50 capturePage sur une vraie page
  await charger(view.webContents, 'https://fr.wikipedia.org/wiki/Navigateur_web');
  await attendre(1500);
  const t = [];
  for (let i = 0; i < 50; i++) {
    const d = performance.now();
    const img = await view.webContents.capturePage();
    img.toJPEG(80);
    t.push(performance.now() - d);
  }
  t.sort((a, b) => a - b);
  res.capture = { mediane: +t[25].toFixed(1), p95: +t[47].toFixed(1), max: +t[49].toFixed(1), unite: 'ms (capture + JPEG)' };

  // 7. setBounds piloté par requestAnimationFrame du shell pendant 1 s
  let recus = 0;
  const fins = [];
  ipcMain.on('bounds', (_e, w) => {
    recus++;
    const d = performance.now();
    view.setBounds({ x: 8, y: 52, width: w, height: 900 });
    fins.push(performance.now() - d);
  });
  await charger(shell.webContents, 'data:text/html,<body style="margin:0;background:%23eee">');
  const cote = await shell.webContents.executeJavaScript(`new Promise(r=>{let n=0;const t0=performance.now();
    (function f(){const e=performance.now()-t0;window.spike.bounds(Math.round(1424-600*Math.min(e,1000)/1000));n++;
    if(e<1000)requestAnimationFrame(f);else r(n)})()})`);
  await attendre(300);
  fins.sort((a, b) => a - b);
  res.setBounds = { framesShell: cote, recusPrincipal: recus, coutMedianMs: +(fins[fins.length >> 1] || 0).toFixed(3) };

  // 8. Coins arrondis
  try { view.setBorderRadius(10); res.setBorderRadius = 'appel OK (rendu à contrôler visuellement)'; }
  catch (e) { res.setBorderRadius = e.message; }

  fs.writeFileSync(path.join(__dirname, 'resultats.json'), JSON.stringify(res, null, 2));
  if (!process.argv.includes('--garder')) app.quit();
});
