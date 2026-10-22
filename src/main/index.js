const { app, BrowserWindow, nativeTheme, screen, session, protocol, shell } = require('electron');
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
const telechargements = require('./telechargements');
const defaut = require('./defaut');
const videomode = require('./videomode');

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
const reconstruireMenu = () => menu.construire({ agir, ui, onglets, etat, fenetre: () => win });
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
  // Barre repliée en rail de 56 px ou masquée : les feux de macOS (≈ 70 px)
  // déborderaient sur la page. On les masque, comme Arc.
  let barreSurvolee = false;
  const feux = () => {
    const r = etat.reglages();
    if (process.platform === 'darwin') win.setWindowButtonVisibility(!r.barreRepliee && (!r.barreMasquee || barreSurvolee));
  };
  // Barre masquée et réapparue au survol du bord : le shell ne voit pas le
  // pointeur partir sur la page (vue native), on le suit d'ici et on la
  // recache dès qu'il s'éloigne de la barre.
  let suivi = 0;
  ipc.action('barre.survol', { type: 'objet', champs: {} }, () => {
    barreSurvolee = true;
    feux();
    clearInterval(suivi);
    let dehors = 0;
    suivi = setInterval(() => {
      if (win.isDestroyed()) return clearInterval(suivi);
      const c = screen.getCursorScreenPoint();
      const b = win.getContentBounds();
      const dedans = c.x >= b.x - 8 && c.x <= b.x + 256 && c.y >= b.y && c.y <= b.y + b.height;
      dehors = dedans ? 0 : dehors + 1;
      if (dehors < 3) return;
      clearInterval(suivi);
      barreSurvolee = false;
      feux();
      ui('barre-quitter');
    }, 100);
  });
  // Le réveil, par le pointeur et pas par le DOM : sous Windows, les premiers
  // pixels du bord d'une fenêtre sans cadre servent à la redimensionner et
  // n'envoient aucun survol à la page ; la bande du shell ne recevait rien.
  let veille = 0;
  const surveillerBord = () => {
    clearInterval(veille);
    if (!etat.reglages().barreMasquee) return;
    veille = setInterval(() => {
      if (win.isDestroyed()) return clearInterval(veille);
      if (barreSurvolee || !win.isVisible() || win.isMinimized()) return;
      const c = screen.getCursorScreenPoint();
      const b = win.getContentBounds();
      if (c.x >= b.x - 6 && c.x <= b.x + 10 && c.y >= b.y && c.y <= b.y + b.height) ui('barre-reveler');
    }, 80);
  };
  surveillerBord();
  feux();
  // Les symboles des boutons suivent le thème clair / sombre.
  if (process.platform !== 'darwin') {
    nativeTheme.on('updated', () => {
      if (!win.isDestroyed()) win.setTitleBarOverlay(boutonsFenetre());
    });
  }
  etat.ecouter((d) => {
    if (d.type === 'settings:changed' && ('barreRepliee' in d.patch || 'barreMasquee' in d.patch)) feux();
    if (d.type === 'settings:changed' && 'barreMasquee' in d.patch) surveillerBord();
  });
  win.once('ready-to-show', () => win.show());
  // Une vidéo sortie ne doit pas garder Escale ouvert une fois la fenêtre fermée.
  win.on('close', () => videomode.fermer());
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

// Un lien ouvert ailleurs (Escale navigateur par défaut) : un onglet de
// l'espace actif. Avant que tout soit prêt, il attend.
const liensEnAttente = [];
let pret = false;
function ouvrirLiens(urls) {
  if (!pret) return liensEnAttente.push(...urls);
  for (const url of urls) onglets.ouvrir(etat.lire().espaceActif, url, { actif: true });
}

app.on('second-instance', (_e, argv) => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
  ouvrirLiens(defaut.liensDe(argv));
});
app.on('open-url', (e, url) => {
  e.preventDefault();
  ouvrirLiens([url]);
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
  // Téléchargements : vidéos YouTube (videos.js, lancées depuis la bulle) et
  // fichiers ordinaires (telechargements.js) partagent la même ligne en bas de
  // la barre, en deltas `video:etat` ; l'identifiant dit qui le porte.
  const ID_TELECHARGEMENT = { type: 'objet', champs: { id: { type: 'string', max: 32 } } };
  ipc.action('video.annuler', ID_TELECHARGEMENT, ({ id }) =>
    telechargements.estLeMien(id) ? telechargements.annuler(id) : videos.annuler(id)
  );
  ipc.action('video.montrer', ID_TELECHARGEMENT, ({ id }) => {
    if (telechargements.estLeMien(id)) return telechargements.montrer(id);
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
  // Installation automatique (Windows) : télécharger en montrant la progression, puis redémarrer à la demande.
  const RIEN = { type: 'objet', champs: {} };
  ipc.action('maj.peutInstaller', RIEN, () => updates.canInstall());
  ipc.action('maj.telecharger', RIEN, () =>
    updates
      .download((pourcent) => ipc.emettre({ type: 'update:progress', pourcent }))
      .then(() => ipc.emettre({ type: 'update:progress', pourcent: 100, pret: true }))
      .catch((e) => ipc.emettre({ type: 'update:progress', erreur: e.message }))
  );
  ipc.action('maj.installer', RIEN, () => updates.install());
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
  pret = true;
  ouvrirLiens([...liensEnAttente.splice(0), ...defaut.liensDe(process.argv.slice(1))]);
  ipc.action('defaut.etat', { type: 'objet', champs: {} }, async () => ({ defaut: await defaut.estParDefaut(), dev: !app.isPackaged }));
  // Historique (page Ctrl+H) et effacement des données de navigation.
  const TEXTE = { type: 'string', max: 500 };
  ipc.action('historique.recents', { type: 'objet', champs: { avant: { type: 'number', optionnel: true } } }, ({ avant }) =>
    contexte.historique.recents(100, avant)
  );
  ipc.action('historique.chercher', { type: 'objet', champs: { texte: TEXTE } }, ({ texte }) => contexte.historique.chercher(texte, 60));
  ipc.action('historique.oublier', { type: 'objet', champs: { url: { type: 'string', max: 8192 } } }, ({ url }) => contexte.historique.oublier(url));
  const DEPUIS = { heure: 3600e3, jour: 86400e3, semaine: 7 * 86400e3, tout: Infinity };
  ipc.action(
    'donnees.effacer',
    {
      type: 'objet',
      champs: {
        periode: { type: 'enum', valeurs: Object.keys(DEPUIS) },
        historique: { type: 'boolean' },
        cookies: { type: 'boolean' },
        cache: { type: 'boolean' }
      }
    },
    async ({ periode, historique: hist, cookies, cache }) => {
      if (hist) contexte.historique.effacer(periode === 'tout' ? 0 : Date.now() - DEPUIS[periode]);
      // Cookies, stockage et cache ne se datent pas : ils partent en entier, dans tous les espaces.
      for (const e of etat.lire().espaces) {
        const ses = session.fromPartition(e.partition);
        if (cookies) await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage', 'filesystem', 'shadercache'] });
        if (cache) await ses.clearCache();
      }
      return true;
    }
  );
  ipc.action('defaut.definir', { type: 'objet', champs: {} }, () => defaut.definir().catch((e) => ({ ok: false, raison: e.message })));
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
