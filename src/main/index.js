const { app, BrowserWindow, nativeTheme, session, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { CHROME_UA } = require('./ua');
const ipc = require('./ipc');
const { urlShell } = require('./ipc-garde');
const store = require('./store');
const etat = require('./etat');
const historique = require('./historique');
const extensions = require('./extensions');
const onglets = require('./onglets');
const menu = require('./menu');
const menusContextuels = require('./menus-contextuels');
const { ACTIONS } = require('./actions');
const suggestions = require('./suggestions');
const updates = require('./updates');
const i18n = require('./i18n');
const dialogue = require('./dialogue');
const importFirefox = require('./import-firefox');
const videos = require('./videos');

// Le mode dev se déduit de l'empaquetage seul, jamais d'un argument.
const isDev = !app.isPackaged;
// --shell-dist : le shell compilé même hors app empaquetée (mesures de perf).
const URL_SHELL = urlShell({
  empaquetee: app.isPackaged,
  argv: process.argv,
  dev: 'http://localhost:5373/',
  dist: pathToFileURL(path.join(__dirname, '../renderer/dist/index.html')).href
});

if (!app.requestSingleInstanceLock()) app.quit();

// Les pages internes (avertissement HTTP) sont servies en escale://.
protocol.registerSchemesAsPrivileged([{ scheme: 'escale', privileges: { standard: true, secure: true } }]);

app.userAgentFallback = CHROME_UA;

let win = null;
const contexte = { etat, onglets, fermes: [], historique: null };
const agir = (nom, payload) => ACTIONS[nom].fn(contexte, payload);
const ui = (nom, id) => ipc.emettre({ type: 'ui:commande', nom, t: Date.now(), ...(id ? { id } : {}) });
const reconstruireMenu = () => menu.construire({ agir, ui, onglets, etat });
const dossierDonnees = () => app.getPath('userData');

// Hors macOS, la barre de titre masquée emporte les boutons de la fenêtre : on
// les rend en surimpression (Windows Controls Overlay), sur fond transparent
// pour laisser passer la teinte de l'espace. Hauteur reprise par le shell.
const HAUTEUR_BOUTONS = 36;
const boutonsFenetre = () => ({
  color: '#00000000',
  symbolColor: nativeTheme.shouldUseDarkColors ? '#eef0f3' : '#2b2e35',
  height: HAUTEUR_BOUTONS
});

function creerFenetre() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    ...(process.platform === 'darwin' ? {} : { titleBarOverlay: boutonsFenetre() }),
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
  dialogue.definirFenetre(win);

  // Le shell ne navigue jamais et n'ouvre jamais de fenêtre.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  contexte.historique = historique.ouvrir(path.join(dossierDonnees(), 'history.sqlite'));
  onglets.init({ fenetre: win, historique: contexte.historique, dev: isDev });
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
  // Barre repliée en rail de 56 px : les feux de macOS (≈ 70 px) déborderaient
  // sur la page. On les masque, comme Arc.
  const feux = () => {
    if (process.platform === 'darwin') win.setWindowButtonVisibility(!etat.reglages().barreRepliee);
  };
  feux();
  // Les symboles des boutons suivent le thème clair / sombre.
  if (process.platform !== 'darwin') {
    nativeTheme.on('updated', () => {
      if (!win.isDestroyed()) win.setTitleBarOverlay(boutonsFenetre());
    });
  }
  etat.ecouter((d) => {
    if (d.type === 'settings:changed' && 'barreRepliee' in d.patch) feux();
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
  const tPret = performance.now();
  app.configureHostResolver({ secureDnsMode: 'automatic' });
  etat.init(dossierDonnees());
  // Thème et langue suivent les réglages ; le menu natif se reconstruit dans la
  // nouvelle langue.
  nativeTheme.themeSource = etat.reglages().theme;
  i18n.setLanguage(etat.reglages().langue);
  etat.ecouter((d) => {
    if (d.type !== 'settings:changed') return;
    if ('theme' in d.patch) nativeTheme.themeSource = d.patch.theme;
    if ('langue' in d.patch) {
      i18n.setLanguage(d.patch.langue);
      reconstruireMenu();
    }
  });
  // Une première installation n'a pas de « Nouveautés » à montrer.
  if (!etat.reglages().derniereVersionVue) etat.regler({ derniereVersionVue: app.getVersion() });
  extensions.brancherShell(session.defaultSession);
  ipc.handle('etat:initial', { type: 'objet', champs: {} }, () => etat.lire());
  for (const [nom, { schema, fn }] of Object.entries(ACTIONS)) ipc.action(nom, schema, (p) => fn(contexte, p));
  menusContextuels.declarer({ action: ipc.action, agir, ui, etat, fenetre: () => win });
  ipc.action('app.infos', { type: 'objet', champs: {} }, () => ({ version: app.getVersion() }));
  // Vidéos YouTube (videos.js) : le menu des formats s'ouvre depuis la bulle de
  // la page (ambiance.js) ; la progression arrive au shell en deltas `video:etat`.
  ipc.action('video.annuler', { type: 'objet', champs: { id: { type: 'string', max: 20 } } }, ({ id }) => videos.annuler(id));
  ipc.action('video.montrer', { type: 'objet', champs: { id: { type: 'string', max: 20 } } }, ({ id }) => {
    const chemin = videos.cheminFini(id);
    if (chemin) shell.showItemInFolder(chemin);
    else shell.openPath(app.getPath('downloads'));
  });
  // Les sessions de Firefox, dans l'espace actif (voir import-firefox.js). Le
  // bouton des réglages, qui dit ce qu'il fait, vaut confirmation.
  ipc.action('import.firefox', { type: 'objet', champs: {} }, async () => {
    const profil = importFirefox.trouverProfil();
    if (!profil) return { erreur: 'introuvable' };
    const espace = etat.lire().espaces.find((e) => e.id === etat.lire().espaceActif);
    const resultat = await importFirefox.importer(session.fromPartition(espace.partition), importFirefox.lireCookies(profil));
    return { ...resultat, espace: espace.nom };
  });
  ipc.action('maj.notes', { type: 'objet', champs: {} }, () =>
    updates.notesFor(app.getVersion(), i18n.getLanguage())
  );
  ipc.action('maj.ouvrir', { type: 'objet', champs: { url: { type: 'string', max: 2048 } } }, ({ url }) => {
    // Seulement une page de GitHub : jamais une adresse arbitraire venue du shell.
    if (/^https:\/\/github\.com\/Luth-infinity\/escale\//.test(url)) shell.openExternal(url);
  });
  const verifierAuRetour = updates.watch((maj) => ipc.emettre({ type: 'update:available', ...maj }));
  app.on('browser-window-focus', verifierAuRetour);
  ipc.action('commande.suggestions', { type: 'objet', champs: { texte: { type: 'string', max: 500 } } }, ({ texte }) =>
    etat.reglages().suggestions ? suggestions.distantes(texte) : []
  );
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
  // Outils de dev : jamais dans l'app empaquetée.
  const apercu = process.argv.find((a) => a.startsWith('--apercu='));
  if (!app.isPackaged && apercu) {
    require(path.join(__dirname, '../../scripts/apercu.js'))({ fenetre: win, onglets, etat, agir, sortie: apercu.slice(9) });
  }
  const verif = process.argv.find((a) => a.startsWith('--verif-mouvement='));
  if (!app.isPackaged && verif) {
    require(path.join(__dirname, '../../scripts/verif-mouvement.js'))({ fenetre: win, onglets, etat, agir, sortie: verif.slice(18) });
  }
  if (!app.isPackaged && process.argv.includes('--perf-liste')) {
    win.webContents.once('did-finish-load', () => require(path.join(__dirname, '../../scripts/perf-liste.js'))({ fenetre: win, etat }));
  }
  if (!app.isPackaged && process.argv.includes('--mesures')) {
    require(path.join(__dirname, '../../scripts/mesures-autotest.js'))({ fenetre: win, onglets, etat, ipc, debut: tPret });
  }
  // --script=<chemin> : un script de diagnostic ponctuel, hors app empaquetée.
  const script = process.argv.find((a) => a.startsWith('--script='));
  if (!app.isPackaged && script) require(path.resolve(script.slice(9)))({ fenetre: win, onglets, etat, ipc, agir });
  // Banc de sécurité (scripts/test-securite.js) : jamais dans l'app empaquetée.
  if (!app.isPackaged && process.argv.includes('--test-securite')) {
    require(path.join(__dirname, '../../scripts/securite-autotest.js'))({ fenetre: win, onglets, etat, ipc, agir });
  }
});

app.on('before-quit', () => store.vider());
app.on('window-all-closed', () => app.quit());
