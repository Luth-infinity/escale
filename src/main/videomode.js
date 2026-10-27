const { BrowserWindow, screen } = require('electron');
const lecteur = require('./lecteur');

/**
 * Le mode vidéo, repris de Hublink (voir son CLAUDE.md) : la page quitte la
 * fenêtre d'Escale pour une petite fenêtre qui reste au-dessus de tout, et
 * n'y montre que sa vidéo. La vue est déplacée, pas recréée : la lecture
 * continue sans recharger. N'importe quel site : la plus grande vidéo de la
 * page sort (lecteur.js).
 *
 * Écart assumé avec Hublink : une seule fenêtre, les commandes sont dans la
 * page, en monde isolé (lecteur.js).
 *
 * Leçons gardées :
 * - Document Picture-in-Picture ne marche pas dans Electron ;
 * - la fenêtre décline le premier plan (focusable: false) : cliquer sur pause
 *   pendant un jeu ne le sort pas du plein écran ; elle n'a donc jamais le
 *   clavier ;
 * - Windows lui fait perdre son rang « au-dessus » sans prévenir quand une
 *   application passe en plein écran : on le réaffirme régulièrement ;
 * - sur YouTube, le son passe par l'API du lecteur, jamais par l'élément ;
 * - déplacer ou redimensionner, c'est redonner position ET taille à chaque
 *   pas : sans cadre mais redimensionnable, la fenêtre grandirait sinon de sa
 *   bordure invisible à chaque appel.
 */
const PETITE = 480;
const GRANDE = 800;
const MIN = 260;
const MARGE = 24;

let fenetreVideo = null;
let idOnglet = null;
let rangement = 0;
let releve = 0;
let suivi = 0;
let ratio = 16 / 9;
let deps = null; // { onglets, poserClasse(wc, sortie), libelles(), youtube: { sur, lireSon, basculerLecture, reglerSon } }

function configurer(d) {
  deps = d;
  deps.onglets.definirRappelSortie(() => fermer());
}

const ouverte = () => Boolean(fenetreVideo && !fenetreVideo.isDestroyed());

/** Donne à la fenêtre les proportions de l'image, en gardant sa largeur. */
function epouser(r) {
  if (!ouverte() || !r || Math.abs(r - ratio) < 0.01) return;
  ratio = r;
  const b = fenetreVideo.getBounds();
  fenetreVideo.setAspectRatio(ratio);
  fenetreVideo.setBounds({ ...b, height: Math.round(b.width / ratio) });
}

async function ouvrir(id) {
  if (!deps || ouverte()) return;
  const wc = deps.onglets.webContentsDe(id);
  if (!wc || wc.isDestroyed() || !(await lecteur.trouver(wc, deps.libelles()))) return;
  const vue = deps.onglets.detacherPourVideo(id);
  if (!vue) return;
  idOnglet = id;
  ratio = 16 / 9;
  const zone = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const hauteur = Math.round(PETITE / ratio);
  fenetreVideo = new BrowserWindow({
    width: PETITE,
    height: hauteur,
    x: zone.x + zone.width - PETITE - MARGE,
    y: zone.y + zone.height - hauteur - MARGE,
    minWidth: MIN,
    minHeight: 120,
    frame: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    focusable: false,
    alwaysOnTop: true,
    backgroundColor: '#000000',
    title: 'Escale',
    show: false
  });
  fenetreVideo.setAspectRatio(ratio);
  fenetreVideo.setAlwaysOnTop(true, 'screen-saver');
  fenetreVideo.contentView.addChildView(vue);
  const poser = () => {
    if (!ouverte()) return;
    const [w, h] = fenetreVideo.getContentSize();
    vue.setBounds({ x: 0, y: 0, width: w, height: h });
    vue.setBorderRadius(0);
  };
  poser();
  vue.setVisible(true);
  fenetreVideo.on('resize', poser);
  fenetreVideo.on('closed', () => {
    // Fermée de l'extérieur (Alt+F4…) : la page revient quand même.
    if (idOnglet) revenir();
  });
  fenetreVideo.showInactive();
  const son = deps.youtube.sur(wc.getURL()) ? await wc.executeJavaScript(deps.youtube.lireSon).catch(() => undefined) : undefined;
  await lecteur.poser(wc, true, son);
  deps.poserClasse(wc, true);
  clearInterval(rangement);
  rangement = setInterval(() => {
    if (ouverte()) fenetreVideo.setAlwaysOnTop(true, 'screen-saver');
  }, 2000);
  relever(wc);
}

/** Relève les demandes des commandes de la page tant que la vidéo est dehors. */
function relever(wc) {
  clearTimeout(releve);
  const tour = async () => {
    if (!ouverte() || wc.isDestroyed()) return;
    const r = await lecteur.prendre(wc);
    if (r?.absente) return fermer(); // la page a changé, sa vidéo est partie
    if (r) {
      epouser(r.ratio);
      for (const d of Array.isArray(r.demandes) ? r.demandes : []) {
        if (d?.type === 'rentrer' || d?.type === 'fermer') return fermer();
        if (d?.type === 'glisser') suivre(d.actif ? 'glisser' : null);
        if (d?.type === 'redim') suivre(d.actif ? 'redim' : null);
        if (d?.type === 'taille') basculerTaille();
        if (d?.type === 'lecture') wc.executeJavaScript(deps.youtube.basculerLecture).catch(() => {});
        if (d?.type === 'son' && Number.isFinite(d.valeur)) wc.executeJavaScript(deps.youtube.reglerSon(d.valeur)).catch(() => {});
      }
    }
    releve = setTimeout(tour, 40);
  };
  tour();
}

/**
 * Glisser ou redimensionner : la fenêtre ne prend jamais le premier plan, on
 * suit donc le pointeur d'ici jusqu'au lâcher. Redimensionner garde les
 * proportions de l'image, le coin haut gauche restant en place.
 */
function suivre(mode) {
  clearInterval(suivi);
  if (!mode || !ouverte()) return;
  const debut = screen.getCursorScreenPoint();
  const b = fenetreVideo.getBounds();
  const fin = Date.now() + 30000; // garde-fou si le lâcher se perd
  suivi = setInterval(() => {
    if (!ouverte() || Date.now() > fin) return clearInterval(suivi);
    const c = screen.getCursorScreenPoint();
    if (mode === 'glisser') {
      fenetreVideo.setBounds({ x: b.x + c.x - debut.x, y: b.y + c.y - debut.y, width: b.width, height: b.height });
    } else {
      const largeur = Math.max(MIN, b.width + Math.max(c.x - debut.x, (c.y - debut.y) * ratio));
      fenetreVideo.setBounds({ x: b.x, y: b.y, width: Math.round(largeur), height: Math.round(largeur / ratio) });
    }
  }, 16);
}

/** Double clic : petite ↔ grande, en gardant le coin bas droit en place. */
function basculerTaille() {
  if (!ouverte()) return;
  const b = fenetreVideo.getBounds();
  const largeur = b.width < (PETITE + GRANDE) / 2 ? GRANDE : PETITE;
  const hauteur = Math.round(largeur / ratio);
  const zone = screen.getDisplayMatching(b).workArea;
  const x = Math.max(zone.x, b.x + b.width - largeur);
  const y = Math.max(zone.y, b.y + b.height - hauteur);
  fenetreVideo.setBounds({ x, y, width: largeur, height: hauteur }, true);
}

function revenir() {
  const id = idOnglet;
  idOnglet = null;
  clearInterval(rangement);
  clearInterval(suivi);
  clearTimeout(releve);
  if (!id) return;
  const wc = deps.onglets.webContentsDe(id);
  if (wc && !wc.isDestroyed()) {
    lecteur.poser(wc, false);
    deps.poserClasse(wc, false);
  }
  deps.onglets.reprendreDeVideo(id);
}

function fermer() {
  if (!ouverte()) return revenir();
  const fen = fenetreVideo;
  fenetreVideo = null;
  // Retirer la vue avant de fermer : la fenêtre l'emporterait avec elle.
  const id = idOnglet;
  const wc = id && deps.onglets.webContentsDe(id);
  const vue = fen.contentView.children[0];
  if (vue) fen.contentView.removeChildView(vue);
  revenir();
  if (wc) wc.focus?.();
  fen.destroy();
}

const estSortie = (id) => idOnglet === id && ouverte();

module.exports = { configurer, ouvrir, fermer, estSortie };
