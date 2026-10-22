const { app, BrowserWindow, nativeTheme, session, protocol } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { CHROME_UA } = require('./ua');
const ipc = require('./ipc');
const store = require('./store');
const etat = require('./etat');
const historique = require('./historique');
const extensions = require('./extensions');
const onglets = require('./onglets');
const menu = require('./menu');
const { ACTIONS } = require('./actions');

const isDev = process.argv.includes('--dev') || !app.isPackaged;
const DEV_SERVER = 'http://localhost:5373/';
const URL_SHELL = isDev
  ? DEV_SERVER
  : pathToFileURL(path.join(__dirname, '../renderer/dist/index.html')).href;

if (!app.requestSingleInstanceLock()) app.quit();

// Les pages internes (avertissement HTTP) sont servies en escale://.
protocol.registerSchemesAsPrivileged([{ scheme: 'escale', privileges: { standard: true, secure: true } }]);

app.userAgentFallback = CHROME_UA;

let win = null;
const contexte = { etat, onglets, fermes: [] };
const agir = (nom, payload) => ACTIONS[nom].fn(contexte, payload);
const ui = (nom) => ipc.emettre({ type: 'ui:commande', nom });
const reconstruireMenu = () => menu.construire({ agir, ui, onglets, etat });
const dossierDonnees = () => app.getPath('userData');

function creerFenetre() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#16171a' : '#fcfcfd',
    webPreferences: {
      preload: path.join(__dirname, '../preload/dist/shell.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  ipc.definirShell(win, URL_SHELL);

  // Le shell ne navigue jamais et n'ouvre jamais de fenêtre.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  onglets.init({ fenetre: win, historique: historique.ouvrir(path.join(dossierDonnees(), 'history.sqlite')), dev: isDev });
  // Gestes : balayage du trackpad (macOS, selon le réglage système) et boutons
  // précédent / suivant de la souris (Windows).
  win.on('swipe', (_e, sens) => {
    if (sens === 'left') agir('nav.precedent', {});
    if (sens === 'right') agir('nav.suivant', {});
  });
  win.on('app-command', (_e, cmd) => {
    if (cmd === 'browser-backward') agir('nav.precedent', {});
    if (cmd === 'browser-forward') agir('nav.suivant', {});
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL(URL_SHELL);
  const actif = etat.lire().ongletActif;
  if (actif) onglets.afficher(actif);
}

// Aucune page ne doit pouvoir embarquer un <webview>.
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-attach-webview', (e) => e.preventDefault());
});

// Un certificat invalide n'est jamais accepté en silence (la page
// d'avertissement arrive avec la gestion des onglets).
app.on('certificate-error', (e, _wc, _url, _err, _cert, rappel) => {
  e.preventDefault();
  rappel(false);
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  app.configureHostResolver({ secureDnsMode: 'automatic' });
  etat.init(dossierDonnees());
  extensions.brancherShell(session.defaultSession);
  ipc.handle('etat:initial', { type: 'objet', champs: {} }, () => etat.lire());
  for (const [nom, { schema, fn }] of Object.entries(ACTIONS)) ipc.action(nom, schema, (p) => fn(contexte, p));
  reconstruireMenu();
  // Le menu porte la liste des espaces (Ctrl+1…9) : il suit leurs changements.
  etat.ecouter((d) => {
    if (d.type.startsWith('space:')) reconstruireMenu();
  });
  // Les onglets du jour inactifs se ferment d'eux-mêmes (réglage, 12 h par défaut).
  const fermerInactifs = () =>
    etat.appliquer('fermerInactifs', Date.now(), (etat.reglages().fermetureAutoHeures || 0) * 3600e3);
  fermerInactifs();
  setInterval(fermerInactifs, 10 * 60e3).unref();
  creerFenetre();
  // Banc de sécurité (scripts/test-securite.js) : jamais dans l'app empaquetée.
  if (!app.isPackaged && process.argv.includes('--test-securite')) {
    require(path.join(__dirname, '../../scripts/securite-autotest.js'))({ fenetre: win, onglets, etat, ipc, agir });
  }
});

app.on('before-quit', () => store.vider());
app.on('window-all-closed', () => app.quit());
