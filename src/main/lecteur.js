/**
 * Les commandes de la vidéo sortie (videomode.js), pour n'importe quel site.
 *
 * Elles vivent dans la page, en monde isolé, sous un Shadow DOM fermé : la
 * fenêtre vidéo est occupée tout entière par la vue native, rien de ce
 * qu'Escale dessinerait ailleurs ne passerait dessus. La page n'est pas
 * remaniée : tout devient invisible, la vidéo choisie repasse visible et fixée
 * sur toute la fenêtre (les lecteurs remettent en place un élément déplacé).
 *
 * Elles ne parlent pas au principal : elles rangent leurs demandes dans une
 * file qu'il relève (`prendre`), comme la bulle YouTube (ambiance.js).
 * Lecture, temps et son agissent directement sur l'élément ; sur YouTube,
 * lecture et son passent par le lecteur, qui réajuste l'élément à chaque pub.
 */
const MONDE = 1202;

function scriptLecteur(L) {
  if (window.__escaleLecteur) return;
  const file = [];
  const youtube = /(^|\.)youtube\.com$/.test(location.hostname);
  let video = null;
  let sortie = false;

  // Toutes les vidéos, y compris dans les Shadow DOM ouverts (lecteurs en
  // composants web).
  const videos = (racine = document, acc = []) => {
    for (const n of racine.querySelectorAll('*')) {
      if (n.tagName === 'VIDEO') acc.push(n);
      if (n.shadowRoot) videos(n.shadowRoot, acc);
    }
    return acc;
  };
  // La vidéo qu'on sort : le lecteur principal sur YouTube, sinon la plus
  // grande qui a de quoi jouer (celle en lecture d'abord).
  const choisir = () => {
    if (youtube) return document.querySelector('#movie_player video.html5-main-video') || document.querySelector('#movie_player video');
    const aire = (v) => v.getBoundingClientRect().width * v.getBoundingClientRect().height;
    const candidates = videos().filter((v) => v.readyState > 0);
    return candidates.sort((a, b) => Number(!b.paused) - Number(!a.paused) || aire(b) - aire(a))[0] || null;
  };

  // Les styles vont EN LIGNE, avec !important : une feuille du document
  // n'atteint pas un Shadow DOM, et un parent transformé (transform, filter,
  // contain…) enfermerait la vidéo « fixed » dans son propre cadre. Les
  // lecteurs réécrivent parfois l'attribut style : on repose à chaque tic.
  const PLEIN = { visibility: 'visible', position: 'fixed', inset: '0', left: '0', top: '0', width: '100vw', height: '100vh',
    'max-width': 'none', 'max-height': 'none', 'object-fit': 'contain', transform: 'none', 'z-index': '2147482000', background: '#000', margin: '0' };
  const NEUTRE = { transform: 'none', filter: 'none', contain: 'none', perspective: 'none', 'will-change': 'auto', 'backdrop-filter': 'none', 'clip-path': 'none' };
  let poses = []; // [élément, style d'origine]
  const parents = (n) => {
    const acc = [];
    for (let p = n.parentNode; p; p = p.parentNode || p.host) if (p.nodeType === 1) acc.push(p);
    return acc;
  };
  const figer = () => {
    if (!video) return;
    const appliquer = (n, props) => {
      if (!poses.some(([x]) => x === n)) poses.push([n, n.getAttribute('style')]);
      for (const [k, v] of Object.entries(props)) if (n.style.getPropertyValue(k) !== v || n.style.getPropertyPriority(k) !== 'important') n.style.setProperty(k, v, 'important');
    };
    appliquer(video, PLEIN);
    for (const p of parents(video)) appliquer(p, NEUTRE);
  };
  const liberer = () => {
    for (const [n, origine] of poses) origine === null ? n.removeAttribute('style') : n.setAttribute('style', origine);
    poses = [];
  };

  // Pas d'innerHTML (Trusted Types de YouTube) : tout se construit à la main.
  const NS = 'http://www.w3.org/2000/svg';
  const el = (nom, attrs = {}, enfants = [], ns) => {
    const e = ns ? document.createElementNS(ns, nom) : document.createElement(nom);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    for (const c of enfants) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
  };
  const trait = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const icone = (...d) => el('svg', { viewBox: '0 0 24 24', ...trait }, d.map((x) => el('path', { d: x }, [], NS)), NS);
  const ICONES = {
    lecture: () => icone('M7 4l13 8-13 8z'),
    pause: () => icone('M8 4v16', 'M16 4v16'),
    recul: () => icone('M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'),
    avance: () => icone('M21 12a9 9 0 1 1-3-6.7', 'M21 4v5h-5'),
    son: () => icone('M11 5L6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'),
    muet: () => icone('M11 5L6 9H3v6h3l5 4z', 'M22 9l-6 6', 'M16 9l6 6'),
    rentrer: () => icone('M10 14L3 21', 'M3 14v7h7', 'M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5'),
    fermer: () => icone('M6 6l12 12', 'M18 6L6 18'),
    poignee: () => icone('M20 12l-8 8', 'M20 17l-3 3')
  };

  const styleSortie = document.createElement('style');
  styleSortie.textContent = `
    html.escale-sortie, html.escale-sortie body { background: #000 !important; overflow: hidden !important; }
    html.escale-sortie body * { visibility: hidden !important; }
  `;

  const hote = el('div', { style: 'position:fixed;inset:0;z-index:2147483000;display:none' });
  const racine = hote.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; font: 500 12px/1 system-ui, -apple-system, 'Segoe UI', sans-serif; }
    .surface { position: absolute; inset: 0; cursor: grab; }
    .surface:active { cursor: grabbing; }
    .voile { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .2s; }
    .visibles .voile { opacity: 1; }
    .haut, .bas { position: absolute; left: 0; right: 0; display: flex; align-items: center; gap: 2px; padding: 8px; color: #fff; }
    .haut { top: 0; background: linear-gradient(rgba(0,0,0,.6), transparent); }
    .bas { bottom: 0; flex-direction: column; align-items: stretch; gap: 4px; padding: 26px 10px 8px; background: linear-gradient(transparent, rgba(0,0,0,.72)); }
    .visibles .haut, .visibles .bas { pointer-events: auto; }
    .titre { flex: 1; min-width: 0; padding: 0 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; opacity: .9; }
    .ligne { display: flex; align-items: center; gap: 2px; }
    .espace { flex: 1; }
    button { all: unset; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; color: #fff; cursor: pointer; }
    button:hover { background: rgba(255,255,255,.16); }
    svg { width: 17px; height: 17px; }
    .temps { padding: 0 6px; font-variant-numeric: tabular-nums; opacity: .92; white-space: nowrap; }
    input[type=range] { -webkit-appearance: none; appearance: none; height: 16px; background: transparent; cursor: pointer; margin: 0; }
    input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 4px;
      background: linear-gradient(to right, #fff var(--p, 0%), rgba(255,255,255,.3) var(--p, 0%)); }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; margin-top: -4px; border-radius: 50%; background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,.5); }
    .progression { width: 100%; }
    .volume { width: 72px; }
    .poignee { position: absolute; right: 0; bottom: 0; width: 22px; height: 22px; display: grid; place-items: center; cursor: nwse-resize;
      color: rgba(255,255,255,.85); pointer-events: auto; }
    .poignee svg { width: 14px; height: 14px; }
    .etroite .volume, .etroite .recul, .etroite .avance { display: none; }
  `;
  const surface = el('div', { class: 'surface' });
  const titre = el('div', { class: 'titre' });
  const bRentrer = el('button', { title: L.rentrer }, [ICONES.rentrer()]);
  const bFermer = el('button', { title: L.fermer }, [ICONES.fermer()]);
  const progression = el('input', { class: 'progression', type: 'range', min: '0', max: '1000', value: '0', 'aria-label': L.position });
  const bLecture = el('button', { title: L.lecture }, [ICONES.pause()]);
  const bRecul = el('button', { class: 'recul', title: L.recul }, [ICONES.recul()]);
  const bAvance = el('button', { class: 'avance', title: L.avance }, [ICONES.avance()]);
  const temps = el('span', { class: 'temps' });
  const bSon = el('button', { title: L.muet }, [ICONES.son()]);
  const volume = el('input', { class: 'volume', type: 'range', min: '0', max: '100', value: '100', 'aria-label': L.volume });
  const poignee = el('div', { class: 'poignee', title: L.redimensionner }, [ICONES.poignee()]);
  const cadre = el('div', { class: 'cadre' }, [
    surface,
    el('div', { class: 'voile' }, [
      el('div', { class: 'haut' }, [titre, bRentrer, bFermer]),
      el('div', { class: 'bas' }, [progression, el('div', { class: 'ligne' }, [bLecture, bRecul, bAvance, temps, el('span', { class: 'espace' }), bSon, volume])])
    ]),
    poignee
  ]);
  racine.append(style, cadre);

  const duree = (s) => {
    if (!Number.isFinite(s)) return '';
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  };
  const peindreCurseur = (input) => input.style.setProperty('--p', `${(Number(input.value) / Number(input.max)) * 100}%`);
  let glisseProgression = false;
  const rafraichir = () => {
    if (!sortie || !video) return;
    figer();
    bLecture.replaceChildren(video.paused ? ICONES.lecture() : ICONES.pause());
    const fini = Number.isFinite(video.duration);
    progression.style.display = fini ? '' : 'none'; // un direct n'a pas de fin
    if (!glisseProgression && fini) progression.value = String(Math.round((video.currentTime / video.duration) * 1000) || 0);
    peindreCurseur(progression);
    temps.textContent = fini ? `${duree(video.currentTime)} / ${duree(video.duration)}` : L.direct;
    bSon.replaceChildren(video.muted || video.volume === 0 ? ICONES.muet() : ICONES.son());
    titre.textContent = document.title;
    cadre.classList.toggle('etroite', innerWidth < 380);
  };

  // Les commandes paraissent au survol, et restent tant que la vidéo est en pause.
  let minuteur = 0;
  const reveiller = () => {
    if (!sortie) return;
    cadre.classList.add('visibles');
    rafraichir();
    clearTimeout(minuteur);
    minuteur = setTimeout(() => video && !video.paused && cadre.classList.remove('visibles'), 2200);
  };
  hote.addEventListener('mousemove', reveiller);
  hote.addEventListener('mouseleave', () => video && !video.paused && cadre.classList.remove('visibles'));

  const lecture = () => {
    if (youtube) return file.push({ type: 'lecture' });
    if (video) video.paused ? video.play().catch(() => {}) : video.pause();
  };
  const son = (v) => {
    volume.value = String(v);
    peindreCurseur(volume);
    if (youtube) return file.push({ type: 'son', valeur: v });
    if (!video) return;
    video.muted = v === 0;
    video.volume = v / 100;
  };
  let avantMuet = 100;
  bSon.addEventListener('click', () => {
    const v = Number(volume.value);
    if (v > 0) avantMuet = v;
    son(v > 0 ? 0 : avantMuet || 100);
  });
  volume.addEventListener('input', () => son(Number(volume.value)));
  bLecture.addEventListener('click', lecture);
  const decaler = (s) => video && (video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + s)));
  bRecul.addEventListener('click', () => decaler(-10));
  bAvance.addEventListener('click', () => decaler(10));
  progression.addEventListener('pointerdown', () => (glisseProgression = true));
  progression.addEventListener('input', () => {
    peindreCurseur(progression);
    if (video && Number.isFinite(video.duration)) video.currentTime = (Number(progression.value) / 1000) * video.duration;
  });
  progression.addEventListener('change', () => (glisseProgression = false));
  bRentrer.addEventListener('click', () => file.push({ type: 'rentrer' }));
  bFermer.addEventListener('click', () => {
    if (video && !video.paused && !youtube) video.pause();
    file.push({ type: 'fermer' });
  });

  // Toute l'image se saisit pour déplacer la fenêtre ; un clic sans bouger
  // met en pause, un double clic l'agrandit ou la réduit. Le principal suit le
  // pointeur : la fenêtre ne prend jamais le premier plan, une zone « drag »
  // n'y suffirait pas.
  let depart = null;
  let clicDiffere = 0;
  surface.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    surface.setPointerCapture(e.pointerId);
    depart = { x: e.screenX, y: e.screenY, bouge: false };
  });
  surface.addEventListener('pointermove', (e) => {
    if (!depart || depart.bouge || Math.hypot(e.screenX - depart.x, e.screenY - depart.y) < 4) return;
    depart.bouge = true;
    file.push({ type: 'glisser', actif: true });
  });
  surface.addEventListener('pointerup', () => {
    if (depart?.bouge) file.push({ type: 'glisser', actif: false });
    else if (depart) {
      clearTimeout(clicDiffere);
      clicDiffere = setTimeout(lecture, 220);
    }
    depart = null;
  });
  surface.addEventListener('pointercancel', () => {
    if (depart?.bouge) file.push({ type: 'glisser', actif: false });
    depart = null;
  });
  surface.addEventListener('dblclick', () => {
    clearTimeout(clicDiffere);
    file.push({ type: 'taille' });
  });
  poignee.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    poignee.setPointerCapture(e.pointerId);
    file.push({ type: 'redim', actif: true });
  });
  const finRedim = () => file.push({ type: 'redim', actif: false });
  poignee.addEventListener('pointerup', finRedim);
  poignee.addEventListener('pointercancel', finRedim);
  for (const ev of ['play', 'pause', 'timeupdate', 'volumechange', 'durationchange']) window.addEventListener(ev, rafraichir, true);
  window.addEventListener('pause', reveiller, true);

  window.__escaleLecteur = {
    // Vrai si la page a une vidéo à sortir.
    trouver: () => Boolean(choisir()),
    sortie: (actif, niveau) => {
      sortie = Boolean(actif);
      if (sortie) {
        video = choisir();
        if (!video) return false;
        figer();
        if (!styleSortie.isConnected) document.documentElement.append(styleSortie);
        if (!hote.isConnected) document.documentElement.append(hote);
        hote.style.display = 'block';
        son(Number.isFinite(niveau) ? niveau : video.muted ? 0 : Math.round(video.volume * 100));
        reveiller();
      } else {
        liberer();
        hote.style.display = 'none';
        cadre.classList.remove('visibles');
        video = null;
      }
      document.documentElement.classList.toggle('escale-sortie', sortie);
      return true;
    },
    // Relevé toutes les 40 ms : c'est aussi le tic qui repose les styles.
    prendre: () => (rafraichir(), {
      demandes: file.splice(0),
      ratio: video && video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 0,
      absente: sortie && (!video || !video.isConnected)
    })
  };
}

const code = (libelles) => `(${scriptLecteur.toString()})(${JSON.stringify(libelles)});`;
const isole = (wc, js) => wc.executeJavaScriptInIsolatedWorld(MONDE, [{ code: js }]);

/** Vrai si la page a une vidéo à sortir (le script est posé au passage). */
async function trouver(wc, libelles) {
  return Boolean(await isole(wc, `${code(libelles)}\nwindow.__escaleLecteur.trouver()`).catch(() => false));
}

/** Passe la page en vidéo seule, commandes au survol, ou l'en sort. */
function poser(wc, actif, son) {
  if (wc.isDestroyed()) return Promise.resolve(false);
  return isole(wc, `window.__escaleLecteur ? window.__escaleLecteur.sortie(${actif ? 'true' : 'false'}, ${Number.isFinite(son) ? son : 'undefined'}) : false`).catch(() => false);
}

const prendre = (wc) => isole(wc, 'window.__escaleLecteur ? window.__escaleLecteur.prendre() : null').catch(() => null);

module.exports = { trouver, poser, prendre };
