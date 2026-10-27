const { WebContentsView, screen, session: sessions, shell } = require('electron');
const etat = require('./etat');
const ipc = require('./ipc');
const extensions = require('./extensions');
const adblock = require('./adblock');
const importFirefox = require('./import-firefox');
const ua = require('./ua');
const ambiance = require('./ambiance');
const videos = require('./videos');
const sponsors = require('./sponsors');
const videomode = require('./videomode');
const { t } = require('./i18n');
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
// L'arrondi de la page suit le réglage « cadre » (les mêmes valeurs que le shell).
const RAYONS = { arrondi: 10, net: 4, bord: 0 };
const rayon = () => RAYONS[etat.reglages().cadre] ?? 10;
// Durée du fondu croisé joué par le shell au changement d'onglet ; la vue
// entrante n'est révélée qu'ensuite (une vue native se peint par-dessus le HTML).
const TRANSITION_MS = 170;
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
let pleinEcran = null; // id de l'onglet dont une vidéo est en plein écran
let sortie = null; // id de l'onglet sorti en mode vidéo (videomode.js)
let rappelSortie = null; // le ramène dans la fenêtre : défini par videomode.js
let minuteurRevele = 0;

const meta = regrouperMeta(250, (id, patch) => {
  if (etat.lire().onglets.some((o) => o.id === id)) etat.appliquer('majMeta', id, patch);
});

function init(options) {
  fenetre = options.fenetre;
  historique = options.historique;
  dev = options.dev;
  // Le mode vidéo emprunte les vues d'ici ; la page y passe en « vidéo seule ».
  videomode.configurer({
    onglets: module.exports,
    poserClasse: (wc, actif) => ambiance.poserSortie(wc, actif),
    libelles: libellesLecteur,
    youtube: { sur: ambiance.surYouTube, ...ambiance.LECTEUR_YOUTUBE }
  });
  etat.ecouter(surDelta);
  // Basculer l'ambiance ou les sponsors prévient aussitôt les pages YouTube ouvertes.
  etat.ecouter((d) => {
    if (d.type === 'settings:changed' && 'cadre' in d.patch) for (const vue of vues.values()) vue.setBorderRadius(rayon());
  });
  etat.ecouter((d) => {
    if (d.type !== 'settings:changed' || !('ambiance' in d.patch || 'sponsors' in d.patch)) return;
    for (const vue of vues.values()) ambiance.appliquer(vue.webContents, etat.reglages());
  });
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
      if (existe(id)) etat.appliquer('activer', id);
    },
    fermerOnglet: (wc) => {
      const id = idDe(wc);
      if (existe(id)) etat.appliquer('fermerOnglet', id);
    },
    fenetre: () => fenetre
  });
  setInterval(balayerVeille, 60_000).unref();
}

const partitionDe = (ses) => etat.lire().espaces.find((e) => sessions.fromPartition(e.partition) === ses)?.partition;

const existe = (id) => Boolean(id) && etat.lire().onglets.some((o) => o.id === id);

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
  ua.brancherSession(ses);
  ses.setSpellCheckerLanguages(['fr', 'en-US']);
  p = extensions.brancherSession(ses, { prive: Boolean(espace.prive) }).then(() => ses);
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
  // nodeIntegrationInSubFrames : malgré son nom, il ne donne pas Node aux cadres
  // (sandbox) ; il y fait tourner le preload de session d'electron-chrome-extensions.
  // Sans lui, un cadre d'extension posé dans une page (le menu de remplissage
  // d'un gestionnaire de mots de passe) n'a que les API natives d'Electron :
  // chrome.tabs.getCurrent, permissions, windows… y manquent.
  const vue = new WebContentsView({
    // plugins : la visionneuse PDF de Chromium ; sans elle, un PDF se télécharge au lieu de s'afficher.
    webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false, nodeIntegrationInSubFrames: true, spellcheck: true, plugins: true }
  });
  vue.setBorderRadius(rayon());
  // Le fond par défaut d'un navigateur : sans lui, une page qui ne peint pas
  // le sien (ou pas encore) laisse voir le shell sombre, un écran noir.
  vue.setBackgroundColor('#ffffff');
  vues.set(id, vue);
  cabler(vue, id);
  extensions.ajouterOnglet(vue.webContents, fenetre);
  // L'ajout l'a marqué actif côté lib : on rétablit l'onglet réellement affiché.
  if (courant && courant !== id && vues.has(courant)) extensions.activerOnglet(vues.get(courant).webContents);
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

// Les textes des commandes de la vidéo sortie (lecteur.js).
const libellesLecteur = () => ({
  rentrer: t('Revenir dans Escale'),
  fermer: t('Fermer'),
  lecture: t('Lecture / pause'),
  recul: t('Reculer de 10 s'),
  avance: t('Avancer de 10 s'),
  position: t('Position'),
  muet: t('Couper le son'),
  volume: t('Volume'),
  redimensionner: t('Glisser pour agrandir'),
  direct: t('En direct')
});

// Les textes de la bulle YouTube, dans la langue d'Escale.
const libellesBulle = () => ({
  ambiance: t('Ambiance'),
  sortir: t('Sortir la vidéo'),
  sponsors: t('Passer sponsors et pubs'),
  telecharger: t('Télécharger'),
  afficher: t('Afficher dans le dossier'),
  revenir: t('Revenir'),
  preparation: t('Préparation…'),
  enCours: t('Téléchargement'),
  termine: t('Téléchargement terminé'),
  echec: t('Le téléchargement a échoué'),
  sponsor: t('Sponsor passé'),
  autopromo: t('Autopromotion passée'),
  formats: videos.LIBELLES.map((l) => (l ? [l[0], t(l[1])] : [null, '']))
});

function cabler(vue, id) {
  const wc = vue.webContents;
  securite.brancherPage(wc, { fenetre: () => fenetre, exceptionsHttp });
  importFirefox.surveillerRefusGoogle(wc);
  ua.suivre(wc);
  ambiance.brancher(wc, {
    reglages: () => etat.reglages(),
    libelles: libellesBulle,
    basculer: (cle) => etat.regler({ [cle]: !etat.reglages()[cle] }),
    // La progression va à la bulle qui l'a demandée et au bas de la barre.
    telecharger: (page, format) =>
      videos.telecharger(
        { url: page.getURL(), format, titre: page.getTitle().replace(/ - YouTube$/, ''), session: page.session },
        (e) => {
          ipc.emettre({ type: 'video:etat', ...e });
          ambiance.signalerVideo(page, e);
        }
      ),
    montrer: (idVideo) => {
      const chemin = videos.cheminFini(idVideo);
      if (chemin) shell.showItemInFolder(chemin);
    },
    passages: (idVideo) => sponsors.passages(idVideo),
    sortir: () => videomode.ouvrir(id),
    estSortie: () => videomode.estSortie(id)
  });

  wc.on('enter-html-full-screen', () => {
    pleinEcran = id;
    poserCourante();
    // La fenêtre finit de s'agrandir après l'événement : on repose une fois posée.
    setTimeout(poserCourante, 150);
  });
  wc.on('leave-html-full-screen', () => {
    if (pleinEcran === id) pleinEcran = null;
    poserCourante();
  });

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
      // Rien n'est noté pour un onglet de navigation privée.
      const espace = etat.lire().espaces.find((e) => e.id === etat.lire().onglets.find((o) => o.id === id)?.espaceId);
      if (/^https?:/.test(url) && !espace?.prive) historique.noterVisite(url, wc.getTitle());
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
    sortirVideo: () => videomode.ouvrir(id),
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
  // La popup « Se connecter avec Google » passe par accounts.google.com : même
  // règle d'UA que les onglets.
  wc.on('did-create-window', (fenetrePopup) => ua.suivre(fenetrePopup.webContents));
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
  // Revenir sur l'onglet sorti en mode vidéo le ramène dans la fenêtre.
  if (sortie && sortie === id) rappelSortie?.(id);
  const n = ++demande;
  const vue = await assurerVue(id);
  if (n !== demande || !vue || !fenetre || fenetre.isDestroyed()) return;
  const precedente = courant ? vues.get(courant) : null;
  // La page sortante est photographiée (≈ 7 ms) : le shell la fait fondre vers
  // la dernière image connue de la page entrante, puis on révèle la vraie.
  let transition = false;
  if (precedente && precedente !== vue && courant !== sortie && !overlay && precedente.getVisible()) {
    const de = await capturer(courant).catch(() => null);
    if (n !== demande) return;
    if (de) {
      ipc.emettre({ type: 'page:transition', de, vers: captures.get(id) || null });
      transition = true;
    }
  }
  clearTimeout(minuteurRevele);
  if (precedente && precedente !== vue && courant !== sortie) fenetre.contentView.removeChildView(precedente);
  courant = id;
  fenetre.contentView.addChildView(vue);
  // Un onglet quitté en plein écran n'y est plus quand on y revient.
  if (pleinEcran && pleinEcran !== id) pleinEcran = null;
  poserCourante();
  const reveler = () => {
    if (n !== demande || overlay) return;
    vue.setVisible(true);
    vue.webContents.focus();
  };
  if (transition) {
    vue.setVisible(false);
    minuteurRevele = setTimeout(reveler, TRANSITION_MS);
  } else {
    vue.setVisible(!overlay);
    if (!overlay) vue.webContents.focus();
  }
  extensions.activerOnglet(vue.webContents);
  emettreNav(id);
}

function masquer() {
  demande++;
  const vue = courant ? vues.get(courant) : null;
  if (vue && courant !== sortie && fenetre && !fenetre.isDestroyed()) fenetre.contentView.removeChildView(vue);
  courant = null;
}

function detruire(id) {
  const vue = vues.get(id);
  if (!vue) return;
  // Fermer un onglet sorti en mode vidéo ferme d'abord sa fenêtre.
  if (sortie === id) rappelSortie?.(id);
  if (courant === id) masquer();
  meta.oublier(id);
  // Retirée de la table AVANT la fermeture : la lib d'extensions rappelle le
  // pont pendant close(), et l'onglet ne doit plus y être trouvé.
  vues.delete(id);
  extensions.retirerOnglet(vue.webContents);
  vue.webContents.close();
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
  // Une page sortie en mode vidéo ne s'endort jamais : on la regarde.
  for (const id of aEndormir(e.onglets, new Set(vues.keys()), courant, Date.now(), delai, joueDuSon)) if (id !== sortie) endormir(id);
}

/**
 * Le mode vidéo (videomode.js) emporte la vue de l'onglet dans sa fenêtre :
 * elle n'appartient plus à la fenêtre principale, qui ne la pose plus. La vue
 * est déplacée, pas recréée : la lecture continue.
 */
function detacherPourVideo(id) {
  const vue = vues.get(id);
  if (!vue || sortie) return null;
  if (courant === id && fenetre && !fenetre.isDestroyed()) fenetre.contentView.removeChildView(vue);
  sortie = id;
  return vue;
}

function reprendreDeVideo(id) {
  if (sortie !== id) return;
  sortie = null;
  const vue = vues.get(id);
  if (!vue || courant !== id || !fenetre || fenetre.isDestroyed()) return;
  fenetre.contentView.addChildView(vue);
  poserCourante();
  vue.setVisible(!overlay);
}

const idSortie = () => sortie;

function surDelta(d, e) {
  if (d.type === 'tab:removed') detruire(d.id);
  else if (d.type === 'active:changed') {
    if (d.ongletActif) afficher(d.ongletActif);
    else masquer();
  } else if (d.type === 'space:removed') sessionsEspace.delete(d.id);
}

/**
 * Où poser la page courante : la zone que le shell lui laisse, ou tout l'écran
 * quand elle est en plein écran (une vidéo). Electron agrandit la fenêtre seul,
 * mais la vue garderait la place du shell, barre latérale comprise.
 *
 * En plein écran, on mesure l'écran, pas la fenêtre : à l'entrée, la fenêtre
 * annonce encore une taille provisoire, et plus aucun resize ne suit (Hublink).
 */
function boite() {
  if (!pleinEcran || pleinEcran !== courant || !fenetre || fenetre.isDestroyed()) return zoneRect;
  const { width, height } = screen.getDisplayMatching(fenetre.getBounds()).bounds;
  return { x: 0, y: 0, width, height };
}

function poserCourante() {
  const vue = courant ? vues.get(courant) : null;
  if (!vue || courant === sortie) return;
  vue.setBounds(boite());
  vue.setBorderRadius(pleinEcran && pleinEcran === courant ? 0 : rayon());
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
  poserCourante();
}

/** Une modale du shell est ouverte : la page native passerait par-dessus. */
function setOverlay(actif) {
  overlay = Boolean(actif);
  // Le clavier va à la modale (Échap, Entrée), pas à la page qu'elle recouvre.
  if (overlay && fenetre && !fenetre.isDestroyed()) fenetre.webContents.focus();
  const vue = courant ? vues.get(courant) : null;
  if (!vue || courant === sortie) return;
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
  webContentsDe, courantId, vivants, idDe, detacherPourVideo, reprendreDeVideo, idSortie,
  definirRappelSortie: (f) => {
    rappelSortie = f;
  }
};
