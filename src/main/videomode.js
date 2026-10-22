const { BrowserWindow, screen } = require('electron');

/**
 * Le mode vidéo, repris de Hublink (voir son CLAUDE.md) : la page YouTube
 * quitte la fenêtre d'Escale pour une petite fenêtre qui reste au-dessus de
 * tout, et n'y montre que la vidéo. La vue est déplacée, pas recréée : la
 * lecture continue sans recharger.
 *
 * Écarts assumés avec Hublink : une seule fenêtre (les commandes sont dans la
 * page, en monde isolé, voir ambiance.js) ; YouTube seulement, depuis la bulle.
 *
 * Leçons gardées :
 * - Document Picture-in-Picture ne marche pas dans Electron ;
 * - la fenêtre décline le premier plan (focusable: false) : cliquer sur pause
 *   pendant un jeu ne le sort pas du plein écran ; elle n'a donc jamais le
 *   clavier ;
 * - Windows lui fait perdre son rang « au-dessus » sans prévenir quand une
 *   application passe en plein écran : on le réaffirme régulièrement ;
 * - le son passe par l'API du lecteur YouTube, jamais par l'élément vidéo.
 */
const LARGEUR = 480;
const MARGE = 24;

let fenetreVideo = null;
let idOnglet = null;
let rangement = 0;
let deps = null; // { onglets, poserClasse(wc, sortie) }

function configurer(d) {
  deps = d;
  deps.onglets.definirRappelSortie(() => fermer());
}

const ouverte = () => Boolean(fenetreVideo && !fenetreVideo.isDestroyed());

function ouvrir(id) {
  if (!deps || ouverte()) return;
  const vue = deps.onglets.detacherPourVideo(id);
  if (!vue) return;
  idOnglet = id;
  const zone = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const hauteur = Math.round((LARGEUR * 9) / 16);
  fenetreVideo = new BrowserWindow({
    width: LARGEUR,
    height: hauteur,
    x: zone.x + zone.width - LARGEUR - MARGE,
    y: zone.y + zone.height - hauteur - MARGE,
    minWidth: 240,
    minHeight: 135,
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
  fenetreVideo.setAspectRatio(16 / 9);
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
  deps.poserClasse(vue.webContents, true);
  clearInterval(rangement);
  rangement = setInterval(() => {
    if (ouverte()) fenetreVideo.setAlwaysOnTop(true, 'screen-saver');
  }, 2000);
}

function revenir() {
  const id = idOnglet;
  idOnglet = null;
  clearInterval(rangement);
  if (!id) return;
  const wc = deps.onglets.webContentsDe(id);
  if (wc && !wc.isDestroyed()) deps.poserClasse(wc, false);
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

/**
 * Glisser la fenêtre depuis la poignée de la page : la fenêtre ne prend jamais
 * le premier plan, on suit donc le pointeur d'ici jusqu'au lâcher.
 */
let glisse = 0;
function glisser(actif) {
  clearInterval(glisse);
  if (!actif || !ouverte()) return;
  const debut = screen.getCursorScreenPoint();
  const b = fenetreVideo.getBounds();
  const fin = Date.now() + 15000; // garde-fou si le lâcher se perd
  glisse = setInterval(() => {
    if (!ouverte() || Date.now() > fin) return clearInterval(glisse);
    const c = screen.getCursorScreenPoint();
    // La taille est redonnée à chaque pas : sans cadre mais redimensionnable, la
    // fenêtre grandirait sinon de sa bordure invisible à chaque appel (Hublink).
    fenetreVideo.setBounds({ x: b.x + c.x - debut.x, y: b.y + c.y - debut.y, width: b.width, height: b.height });
  }, 16);
}

const estSortie = (id) => idOnglet === id && ouverte();

module.exports = { configurer, ouvrir, fermer, glisser, estSortie };
