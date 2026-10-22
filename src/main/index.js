const { app, BrowserWindow, nativeTheme } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { CHROME_UA } = require('./ua');
const ipc = require('./ipc');
const store = require('./store');

const isDev = process.argv.includes('--dev') || !app.isPackaged;
const DEV_SERVER = 'http://localhost:5373/';
const URL_SHELL = isDev
  ? DEV_SERVER
  : pathToFileURL(path.join(__dirname, '../renderer/dist/index.html')).href;

if (!app.requestSingleInstanceLock()) app.quit();

app.userAgentFallback = CHROME_UA;

let win = null;
let etat = null;
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
      preload: path.join(__dirname, '../preload/shell.js'),
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

  win.once('ready-to-show', () => win.show());
  win.loadURL(URL_SHELL);
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
  etat = store.charger(dossierDonnees());
  ipc.handle('etat:initial', { type: 'objet', champs: {} }, () => etat);
  creerFenetre();
});

app.on('before-quit', () => store.vider());
app.on('window-all-closed', () => app.quit());
