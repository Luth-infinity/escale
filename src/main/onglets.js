const { WebContentsView, session: sessions } = require('electron');
const etat = require('./etat');
const ipc = require('./ipc');
const extensions = require('./extensions');
const adblock = require('./adblock');
const favicon = require('./favicon');
const menucontextuel = require('./menucontextuel');
const securite = require('./securite-pages');
const { isUsableFavicon, searchUrl } = require('./urls');
const { politiqueSchema, versHttps } = require('./schemas');
const { aEndormir, regrouperMeta } = require('./onglets-purs');

/**
 * Les pages : une WebContentsView par onglet vivant, posée par le process
 * principal dans la zone que le shell lui laisse.
 *
 * Le modèle (etat.js) décide ; ce module suit ses deltas. Activer un onglet,
 * c'est appliquer `activer` au modèle : le delta `active:changed` revient ici
 * et la vue s'affiche.
 */
const RAYON = 10;
const CALME_HISTORIQUE_MS = 1500;
const OUVERTURES_MAX = 3; // par ouvreur, sur la fenêtre ci-dessous
const OUVERTURES_FENETRE_MS = 2000;

let fenetre = null;
let historique = null;
let dev = false;
const vues = new Map(); // id → WebContentsView
const sessionsEspace = new Map(); // espaceId → Promise<Session>
const joueDuSon = new Set();
const captures = new Map(); // id → data URL
const exceptionsHttp = new Set(); // hôtes acceptés en HTTP, jusqu'à la fermeture
let courant = null;
let demande = 0;
let zoneRect = { x: 0, y: 0, width: 0, height: 0 };
let overlay = false;

const meta = regrouperMeta(250, (id, patch) => {
  if (etat.lire().onglets.some((o) => o.id === id)) etat.appliquer('majMeta', id, patch);
});

function init(options) {
  fenetre = options.fenetre;
  historique = options.historique;
  dev = options.dev;
  etat.ecouter(surDelta);
  extensions.definirPont({
    creerOnglet: async (details, ses) => {
      const espace = etat.lire().espaces.find((e) => e.partition === partitionDe(ses));
      if (!espace) throw new Error('espace introuvable pour cette session');
      const id = ouvrir(espace.id, details.url || 'about:blank', { apres: courant, actif: details.active !== false });
      const vue = await assurerVue(id);
      return [vue.webContents, fenetre];
    },
    activerOnglet: (wc) => {
      const id = idDe(wc);
      if (id) etat.appliquer('activer', id);
    },
    fermerOnglet: (wc) => {
      const id = idDe(wc);
      if (id) etat.appliquer('fermerOnglet', id);
    },
    fenetre: () => fenetre
  });
  setInterval(balayerVeille, 60_000).unref();
}

const partitionDe = (ses) => etat.lire().espaces.find((e) => sessions.fromPartition(e.partition) === ses)?.partition;

function idDe(wc) {
  for (const [id, v] of vues) if (v.webContents === wc) return id;
  return null;
}

function assurerSession(espace) {
  let p = sessionsEspace.get(espace.id);
  if (p) return p;
  const ses = sessions.fromPartition(espace.partition);
  securite.brancherSession(ses, { fenetre: () => fenetre });
  securite.servirPagesInternes(ses);
  adblock.applyTo(ses, () => etat.reglages().bloqueur);
  ses.setSpellCheckerLanguages(['fr', 'en-US']);
  p = extensions.brancherSession(ses).then(() => ses);
  sessionsEspace.set(espace.id, p);
  return p;
}

function emettreEtat(id) {
  ipc.emettre({ type: 'tab:etat', id, vivant: vues.has(id), son: joueDuSon.has(id) });
}

/** Ouvre un onglet dans le modèle ; renvoie son id. */
function ouvrir(espaceId, url, { apres = null, actif = true } = {}) {
  const r = etat.appliquer('ouvrirOnglet', { espaceId, url, apres });
  const id = r.deltas.find((d) => d.type === 'tab:added').onglet.id;
  if (actif) etat.appliquer('activer', id);
  else assurerVue(id);
  return id;
}

async function assurerVue(id) {
  const existante = vues.get(id);
  if (existante) return existante;
  const onglet = etat.lire().onglets.find((o) => o.id === id);
  if (!onglet) return null;
  const espace = etat.lire().espaces.find((e) => e.id === onglet.espaceId);
  const ses = await assurerSession(espace);
  // Une autre demande a pu créer la vue pendant l'attente de la session.
  if (vues.has(id)) return vues.get(id);
  if (!etat.lire().onglets.some((o) => o.id === id)) return null;
  const vue = new WebContentsView({
    webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: true }
  });
  vue.setBorderRadius(RAYON);
  vues.set(id, vue);
  cabler(vue, id);
  extensions.ajouterOnglet(vue.webContents, fenetre);
  charger(vue.webContents, onglet.url);
  emettreEtat(id);
  return vue;
}

/** Le chargement d'Escale : une adresse http est relevée en https d'office. */
function charger(wc, url) {
  if (politiqueSchema(url) !== 'web') url = 'about:blank';
  wc.loadURL(versHttps(url, exceptionsHttp) || url).catch(() => {});
}

function hote(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function cabler(vue, id) {
  const wc = vue.webContents;
  securite.brancherPage(wc, { fenetre: () => fenetre, exceptionsHttp });

  wc.on('page-title-updated', (_e, titre) => meta(id, { titre }));
  wc.on('page-favicon-updated', async (_e, icones) => {
    const url = (icones || []).find(isUsableFavicon);
    if (!url) return;
    const data = await favicon.toDataUrl(wc.session, url);
    if (data) meta(id, { favicon: data });
  });

  let minuteurHistorique = null;
  const noter = () => {
    clearTimeout(minuteurHistorique);
    minuteurHistorique = setTimeout(() => {
      const url = wc.isDestroyed() ? '' : wc.getURL();
      if (/^https?:/.test(url)) historique.noterVisite(url, wc.getTitle());
    }, CALME_HISTORIQUE_MS);
  };

  let minuteurNav = null;
  const nav = () => {
    if (minuteurNav) return;
    minuteurNav = setTimeout(() => {
      minuteurNav = null;
      if (!wc.isDestroyed()) emettreNav(id);
    }, 250);
  };
  wc.on('did-navigate', (_e, url) => {
    meta(id, { url });
    const facteur = etat.reglages().zoom[hote(url)] || 1;
    if (wc.getZoomFactor() !== facteur) wc.setZoomFactor(facteur);
    nav();
  });
  wc.on('did-navigate-in-page', (_e, url, principale) => {
    if (principale) meta(id, { url });
    nav();
  });
  wc.on('did-start-loading', nav);
  wc.on('did-stop-loading', () => {
    nav();
    noter();
  });
  wc.on('audio-state-changed', (e) => {
    if (e.audible) joueDuSon.add(id);
    else joueDuSon.delete(id);
    emettreEtat(id);
  });
  wc.once('destroyed', () => {
    clearTimeout(minuteurHistorique);
    clearTimeout(minuteurNav);
  });

  menucontextuel.brancher(wc, {
    fenetre,
    ouvrirOnglet: (url) => {
      const o = etat.lire().onglets.find((x) => x.id === id);
      if (o) ouvrir(o.espaceId, url, { apres: id, actif: false });
    },
    rechercher: searchUrl,
    extensions: (params) => extensions.menuContextuel(wc, params),
    dev
  });

  // Un lien `target=_blank` ou un window.open sans dimensions : un onglet du
  // même espace, sous l'ouvreur. Avec dimensions (popup OAuth) : une fenêtre
  // fille, qui hérite de la session de l'ouvreur — ne JAMAIS y passer
  // `session` ni `partition`, ce serait la sortir de son espace.
  const ouvertures = [];
  wc.setWindowOpenHandler(({ url, features, disposition }) => {
    const maintenant = Date.now();
    while (ouvertures.length && ouvertures[0] < maintenant - OUVERTURES_FENETRE_MS) ouvertures.shift();
    if (ouvertures.length >= OUVERTURES_MAX || politiqueSchema(url) !== 'web') return { action: 'deny' };
    ouvertures.push(maintenant);
    if (features && disposition === 'new-window') {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 720, autoHideMenuBar: true } };
    }
    if (url && url !== 'about:blank') {
      const o = etat.lire().onglets.find((x) => x.id === id);
      if (o) ouvrir(o.espaceId, url, { apres: id, actif: disposition !== 'background-tab' });
    }
    return { action: 'deny' };
  });
}

function emettreNav(id) {
  if (id !== courant) return;
  const vue = vues.get(id);
  if (!vue) return;
  const wc = vue.webContents;
  ipc.emettre({
    type: 'nav:state',
    id,
    url: wc.getURL(),
    peutReculer: wc.navigationHistory.canGoBack(),
    peutAvancer: wc.navigationHistory.canGoForward(),
    chargement: wc.isLoading()
  });
}

/** Affiche un onglet ; seul le dernier appel l'emporte. */
async function afficher(id) {
  const n = ++demande;
  const vue = await assurerVue(id);
  if (n !== demande || !vue || !fenetre || fenetre.isDestroyed()) return;
  const precedente = courant ? vues.get(courant) : null;
  if (precedente && precedente !== vue) fenetre.contentView.removeChildView(precedente);
  courant = id;
  fenetre.contentView.addChildView(vue);
  vue.setBounds(zoneRect);
  vue.setVisible(!overlay);
  if (!overlay) vue.webContents.focus();
  extensions.activerOnglet(vue.webContents);
  emettreNav(id);
}

function masquer() {
  demande++;
  const vue = courant ? vues.get(courant) : null;
  if (vue && fenetre && !fenetre.isDestroyed()) fenetre.contentView.removeChildView(vue);
  courant = null;
}

function detruire(id) {
  const vue = vues.get(id);
  if (!vue) return;
  if (courant === id) masquer();
  meta.oublier(id);
  extensions.retirerOnglet(vue.webContents);
  vue.webContents.close();
  vues.delete(id);
  captures.delete(id);
  joueDuSon.delete(id);
}

function endormir(id) {
  detruire(id);
  emettreEtat(id);
}

function balayerVeille() {
  const e = etat.lire();
  const delai = (e.reglages.veilleMinutes || 0) * 60_000;
  for (const id of aEndormir(e.onglets, new Set(vues.keys()), courant, Date.now(), delai, joueDuSon)) endormir(id);
}

function surDelta(d, e) {
  if (d.type === 'tab:removed') detruire(d.id);
  else if (d.type === 'active:changed') {
    if (d.ongletActif) afficher(d.ongletActif);
    else masquer();
  } else if (d.type === 'space:removed') sessionsEspace.delete(d.id);
}

/** La géométrie de la zone de page, mesurée par le shell. */
function zone(rect) {
  const r = {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height))
  };
  if (r.x === zoneRect.x && r.y === zoneRect.y && r.width === zoneRect.width && r.height === zoneRect.height) return;
  zoneRect = r;
  const vue = courant ? vues.get(courant) : null;
  if (vue) vue.setBounds(r);
}

/** Une modale du shell est ouverte : la page native passerait par-dessus. */
function setOverlay(actif) {
  overlay = Boolean(actif);
  const vue = courant ? vues.get(courant) : null;
  if (!vue) return;
  vue.setVisible(!overlay);
  if (!overlay) vue.webContents.focus();
}

async function capturer(id) {
  const vue = vues.get(id);
  if (!vue) return captures.get(id) || null;
  const image = await vue.webContents.capturePage();
  const data = `data:image/jpeg;base64,${image.toJPEG(70).toString('base64')}`;
  captures.set(id, data);
  return data;
}

function naviguer(id, url) {
  const vue = vues.get(id);
  if (vue) charger(vue.webContents, url);
  else etat.appliquer('majMeta', id, { url });
}

const webContentsDe = (id) => vues.get(id)?.webContents || null;
const courantId = () => courant;
const vivants = () => [...vues.keys()];

module.exports = {
  init, ouvrir, afficher, masquer, endormir, zone, setOverlay, capturer, naviguer, assurerVue, assurerSession,
  webContentsDe, courantId, vivants, idDe
};
