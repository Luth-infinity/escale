const { app } = require('electron');
const dialogue = require('./dialogue');
const path = require('node:path');
const crx = require('./crx');
const P = require('./permissions-ext');
const { versChrome } = require('./webrequest-ext');
const { t } = require('./i18n');

/**
 * Les extensions Chrome, par electron-chrome-extensions (API chrome.*) et
 * electron-chrome-web-store (installation et mises à jour depuis le Store).
 *
 * Toutes les sessions d'espace partagent le même dossier d'extensions : une
 * extension installée dans un espace est chargée dans tous les autres.
 */

// La lib du Store télécharge avec le `fetch` global, capturé au chargement du
// module. On lui en prête un qui vérifie la signature de tout paquet CRX qui
// passe (installation comme mise à jour), puis on rend le vrai.
const fetchOrigine = globalThis.fetch;
globalThis.fetch = async function fetchVerifie(...args) {
  const r = await fetchOrigine(...args);
  if (!r.ok) return r;
  const corps = Buffer.from(await r.arrayBuffer());
  if (corps.subarray(0, 4).toString('binary') === 'Cr24') {
    const v = crx.verifier(corps);
    if (!v.ok) throw new Error(`Paquet d'extension refusé : ${v.raison}`);
  }
  return new Response(corps, { status: r.status, statusText: r.statusText, headers: r.headers });
};
const store = require('electron-chrome-web-store');
globalThis.fetch = fetchOrigine;
const { ElectronChromeExtensions } = require('electron-chrome-extensions');

const branchees = new Map(); // session → { ece, prive }
// La lib rappelle selectTab même quand c'est nous qui l'informons (addTab marque
// l'onglet ajouté comme actif). Seuls les appels venus d'une extension
// (chrome.tabs.update…) doivent remonter au pont.
let interne = false;
const enInterne = (f) => {
  interne = true;
  try {
    return f();
  } finally {
    interne = false;
  }
};
let pont = null;
let premiere = null;
const dossier = () => path.join(app.getPath('userData'), 'Extensions');

/**
 * Le gestionnaire d'onglets se présente ici, pour que les extensions puissent
 * ouvrir, activer et fermer des onglets.
 * { creerOnglet(details, session) → Promise<[WebContents, BaseWindow]>,
 *   activerOnglet(wc), fermerOnglet(wc), fenetre() → BaseWindow }
 */
function definirPont(p) {
  pont = p;
}

async function demanderAccord({ localizedName, manifest }) {
  const peut = P.decrire(manifest).map((p) => t(p));
  const absentes = P.manquantes(manifest);
  const oui = await dialogue.demander({
    titre: t('Ajouter « {nom} » ?', { nom: localizedName }),
    detail: peut.length ? t('Elle pourra :') : t('Elle ne demande aucune permission sensible.'),
    points: peut,
    avertissement: absentes.length ? t('Ne fonctionnera pas entièrement dans Escale : {api}', { api: absentes.join(', ') }) : '',
    annuler: t('Annuler'),
    confirmer: t("Ajouter l'extension")
  });
  return { action: oui ? 'allow' : 'deny' };
}

// Une extension chargée (installée ou mise à jour) dans un espace l'est dans
// tous les autres, à la même version.
function propager(ext, depuis) {
  for (const [ses, { prive }] of branchees) {
    if (ses === depuis || prive) continue;
    const deja = ses.extensions.getExtension(ext.id);
    if (deja && deja.version === ext.version) continue;
    if (deja) ses.extensions.removeExtension(ext.id);
    ses.extensions.loadExtension(ext.path).catch((e) => console.error('extension', ext.id, e.message));
  }
}

// Sous Windows avec un affichage mis à l'échelle (125 %…), la fenêtre du popup
// n'obtient pas la taille que la lib lui donne : Dashlane (350 × 561) s'ouvrait
// en 323 × 548, coupé à droite et en bas. On reprend le dimensionnement : la
// taille préférée de Chromium, corrigée d'après ce que la page voit vraiment,
// une passe à la fois.
const LIMITE_POPUP = { width: 800, height: 600 };

// Le placement de la lib (updatePosition) réapplique les dimensions extérieures,
// que Windows rogne de son cadre invisible : on place sans toucher à la taille.
function placer(popup) {
  const win = popup.browserWindow;
  const parent = popup.parent;
  if (!win || !parent || parent.isDestroyed()) return;
  const fen = parent.getBounds();
  const barre = fen.height - parent.getContentBounds().height;
  const vue = win.getBounds();
  const a = popup.anchorRect;
  let x = fen.x + a.x + a.width - vue.width;
  let y = fen.y + barre + a.y + a.height + 5;
  if (popup.alignment?.includes('right')) x = fen.x + a.x;
  if (popup.alignment?.includes('top')) y = fen.y + barre - vue.height + a.y - 5;
  win.setPosition(Math.floor(x), Math.floor(y));
}
function ajusterPopup(popup) {
  const win = popup.browserWindow;
  if (!win) return;
  win.webContents.off('preferred-size-changed', popup.updatePreferredSize);
  // Non redimensionnable, la fenêtre est bornée à sa taille (minimum = maximum)
  // et Windows la rogne de son cadre à chaque reverrouillage : on la laisse
  // libre. Elle se ferme de toute façon dès qu'elle perd le focus.
  win.setResizable(true);
  const lire = () =>
    win.webContents
      .executeJavaScript('[document.documentElement.scrollWidth, document.documentElement.scrollHeight, innerWidth, innerHeight]')
      .catch(() => null);
  let enCours = false;
  let encore = false;
  let prefere = { width: 0, height: 0 };
  const dimensionner = async (_e, taille) => {
    if (taille) prefere = taille;
    if (enCours) {
      encore = true;
      return;
    }
    enCours = true;
    try {
      for (let passe = 0; passe < 4; passe++) {
        if (popup.isDestroyed() || win.isDestroyed()) return;
        const m = await lire();
        if (!m || popup.isDestroyed() || win.isDestroyed()) return;
        const [w, h, vw, vh] = m;
        // La taille préférée de Chromium est juste ; la page la complète si elle
        // déborde encore (arrondis de l'échelle).
        const voulu = {
          width: Math.min(Math.max(prefere.width, w > vw ? w : 0, 1), LIMITE_POPUP.width),
          height: Math.min(Math.max(prefere.height, h > vh ? h : 0, 1), LIMITE_POPUP.height)
        };
        if (vw === voulu.width && vh === voulu.height) break;
        const [cw, ch] = win.getContentSize();
        win.setContentSize(Math.max(1, cw + voulu.width - vw), Math.max(1, ch + voulu.height - vh));
        await new Promise((r) => setTimeout(r, 30));
      }
      if (popup.isDestroyed() || win.isDestroyed()) return;
      placer(popup);
      if (popup.hidden) popup.show();
    } finally {
      enCours = false;
      if (encore) {
        encore = false;
        dimensionner();
      }
    }
  };
  win.webContents.on('preferred-size-changed', dimensionner);
  win.webContents.on('did-finish-load', dimensionner);
}

/** À appeler avant le premier loadURL d'une session. */
async function brancherSession(ses, { prive = false } = {}) {
  if (branchees.has(ses)) return;
  // Avant la lib : son preload fige `chrome` une fois ses API posées.
  ses.registerPreloadScript({
    id: 'escale-webrequest',
    type: 'service-worker',
    filePath: path.join(__dirname, '../preload/webrequest-ext.js')
  });
  const ece = new ElectronChromeExtensions({
    license: 'GPL-3.0',
    session: ses,
    createTab: (details) => pont.creerOnglet(details, ses),
    selectTab: (wc) => !interne && pont.activerOnglet(wc),
    removeTab: (wc) => pont.fermerOnglet(wc),
    createWindow: async (details) => {
      const url = [].concat(details.url || [])[0];
      if (url) await pont.creerOnglet({ url, active: true }, ses);
      return pont.fenetre();
    }
  });
  ece.on('browser-action-popup-created', ajusterPopup);
  // Après celui de la lib : chrome.privacy qui répond (preload-extensions.js).
  for (const type of ['frame', 'service-worker']) {
    ses.registerPreloadScript({ id: `escale-privacy-${type}`, type, filePath: path.join(__dirname, 'preload-extensions.js') });
  }
  branchees.set(ses, { ece, prive });
  // Une seule session vérifie les mises à jour : elles écrivent toutes dans le
  // même dossier, et la propagation met les autres à niveau.
  const majAuto = !prive && !premiere;
  if (!prive && !premiere) premiere = ses;
  await store.installChromeWebStore({
    session: ses,
    extensionsPath: dossier(),
    loadExtensions: !prive,
    autoUpdate: majAuto,
    beforeInstall: demanderAccord
  });
  if (!prive) ses.extensions.on('extension-loaded', (_e, ext) => propager(ext, ses));
}

/** Relaie une requête aux extensions qui écoutent webRequest.onBeforeRequest. */
function diffuserRequete(ses, details) {
  const router = branchees.get(ses)?.ece.ctx.router;
  if (!router?.listeners.get('webRequest.onBeforeRequest')?.length) return;
  // Sans webContents, la requête vient d'un service worker : pas d'onglet (-1).
  router.broadcastEvent('webRequest.onBeforeRequest', versChrome(details, Boolean(details.webContents)));
}

const sessionDe = (wc) => [...branchees].find(([ses]) => ses === wc.session)?.[1];

function ajouterOnglet(wc, fenetre) {
  enInterne(() => sessionDe(wc)?.ece.addTab(wc, fenetre));
}
function retirerOnglet(wc) {
  sessionDe(wc)?.ece.removeTab(wc);
}
function activerOnglet(wc) {
  enInterne(() => sessionDe(wc)?.ece.selectTab(wc));
}
function menuContextuel(wc, params) {
  return sessionDe(wc)?.ece.getContextMenuItems(wc, params) || [];
}

async function retirer(id) {
  for (const ses of branchees.keys()) if (ses.extensions.getExtension(id)) ses.extensions.removeExtension(id);
  if (premiere) await store.uninstallExtension(id, { session: premiere, extensionsPath: dossier() }).catch(() => {});
}

function lister() {
  if (!premiere) return [];
  return premiere.extensions.getAllExtensions().map((e) => ({
    id: e.id,
    nom: e.name,
    version: e.version,
    permissions: P.decrire(e.manifest),
    manquantes: P.manquantes(e.manifest)
  }));
}

/** Les icônes servies en crx:// au shell (session par défaut). */
function brancherShell(ses) {
  ElectronChromeExtensions.handleCRXProtocol(ses);
}

module.exports = {
  definirPont, brancherSession, brancherShell, diffuserRequete, ajouterOnglet, retirerOnglet, activerOnglet, menuContextuel,
  retirer, lister
};
