/**
 * L'ambiance YouTube, reprise de Hublink : pendant la lecture, la vidéo se
 * prolonge derrière toute la page, agrandie et adoucie, et la page devient
 * translucide par-dessus. Coupée par défaut : c'est un goût, pas un confort.
 *
 * Escale n'a pas de preload dans les pages : le script est posé par le
 * principal sur les seules pages youtube.com, dans un monde isolé (le DOM est
 * partagé, pas les variables de la page), puis piloté par le réglage.
 */
const MONDE = 1201;

const surYouTube = (url) => {
  try {
    return /(^|\.)youtube\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

/* Tourne dans la page (monde isolé). Voir CLAUDE.md de Hublink pour les essais
   écartés : taches de couleurs, vidéo entière agrandie, bords étirés depuis
   l'image pleine. */
function scriptAmbiance() {
  if (window.__escaleAmbiance) return;
  const STYLE = `
    html.escale-ambiance { --escale-fond: #fff; }
    html.escale-ambiance[dark] { --escale-fond: #0f0f0f; }
    html.escale-ambiance body { background: transparent !important; }
    html.escale-ambiance ytd-app {
      --yt-spec-base-background: transparent;
      --yt-spec-general-background-a: transparent;
      background: transparent !important;
    }
    html.escale-ambiance tp-yt-app-drawer,
    html.escale-ambiance ytd-popup-container {
      --yt-spec-base-background: var(--escale-fond);
      --yt-spec-general-background-a: var(--escale-fond);
    }
    html.escale-ambiance #masthead-container {
      background: color-mix(in srgb, var(--escale-fond) 30%, transparent) !important;
      backdrop-filter: blur(24px);
    }
    html.escale-ambiance ytd-watch-flexy[theater] #full-bleed-container,
    html.escale-ambiance ytd-watch-flexy[fullscreen] #full-bleed-container { background: transparent !important; }
    html.escale-ambiance #cinematics,
    html.escale-ambiance #cinematics-container { display: none !important; }
    #escale-ambiance { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; display: none; }
    html.escale-ambiance #escale-ambiance { display: block; }
    #escale-ambiance canvas { width: 100%; height: 100%; filter: blur(24px) saturate(1.35) brightness(1.05); }
    html[dark] #escale-ambiance canvas { filter: blur(24px) saturate(1.4) brightness(0.8); }
    #escale-ambiance::after { content: ''; position: absolute; inset: 0; background: rgba(255, 255, 255, 0.3); }
    html[dark] #escale-ambiance::after { background: rgba(15, 15, 15, 0.15); }
    html.escale-ambiance ytd-app { --yt-spec-text-secondary: rgba(0, 0, 0, 0.78); text-shadow: 0 1px 3px rgba(255, 255, 255, 0.55); }
    html.escale-ambiance[dark] ytd-app {
      --yt-spec-text-primary: #fff;
      --yt-spec-text-secondary: rgba(255, 255, 255, 0.85);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    }
  `;
  // Au-dessus de 256 × 256 points, Chromium confie la toile à la carte graphique.
  const LARGEUR = 384;
  // La copie d'où partent les bords étirés : petite, pour des bandes larges et lisses.
  const MINIATURE = 8;
  const HALO = 1.3;
  const ANALYSE_LARGEUR = 64;
  const SEUIL_NOIR = 26;
  const PLEIN_CADRE = { x: 0, y: 0, l: 1, h: 1 };

  const a = {
    actif: false, boite: null, toile: null, ctx: null, miniature: null, halo: null, masque: null,
    cleMasque: '', analyse: null, cadre: PLEIN_CADRE, candidat: null, sourceCadre: '', releve: 0,
    video: null, generation: 0
  };
  const toileDeTravail = () => {
    const c = document.createElement('canvas');
    return { c, ctx: c.getContext('2d') };
  };

  const ajusterToile = () => {
    if (!a.toile) return;
    a.toile.width = LARGEUR;
    a.toile.height = Math.max(1, Math.round((LARGEUR * innerHeight) / Math.max(1, innerWidth)));
    for (const t of [a.halo, a.masque]) {
      t.c.width = a.toile.width;
      t.c.height = a.toile.height;
    }
    a.cleMasque = '';
    if (a.video) peindre(a.video);
  };

  // Le masque du halo : bords fondus, recalculé seulement quand le lecteur bouge.
  const preparerMasque = (hx, hy, hw, hh) => {
    const cle = [hx, hy, hw, hh].map(Math.round).join(',');
    if (cle === a.cleMasque) return;
    a.cleMasque = cle;
    const { c, ctx } = a.masque;
    const f = Math.max(2, Math.min(hw, hh) * 0.09);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.filter = `blur(${f}px)`;
    ctx.fillStyle = '#000';
    ctx.fillRect(hx + f * 1.6, hy + f * 1.6, hw - f * 3.2, hh - f * 3.2);
    ctx.filter = 'none';
  };

  // Les bandes noires incrustées (film au format cinéma) : l'ambiance part du
  // bord de l'image réelle, sinon elle prolonge du noir.
  const releverCadre = (v) => {
    const an = a.analyse;
    const aw = ANALYSE_LARGEUR;
    const ah = Math.max(8, Math.round((aw * v.videoHeight) / v.videoWidth));
    if (an.c.width !== aw || an.c.height !== ah) {
      an.c.width = aw;
      an.c.height = ah;
    }
    an.ctx.drawImage(v, 0, 0, aw, ah);
    let px;
    try {
      px = an.ctx.getImageData(0, 0, aw, ah).data;
    } catch {
      return null;
    }
    const sombre = (x, y) => {
      const i = (y * aw + x) * 4;
      return Math.max(px[i], px[i + 1], px[i + 2]) < SEUIL_NOIR;
    };
    const rangeeSombre = (y) => {
      for (let x = 0; x < aw; x++) if (!sombre(x, y)) return false;
      return true;
    };
    const colonneSombre = (x, haut, bas) => {
      for (let y = haut; y < bas; y++) if (!sombre(x, y)) return false;
      return true;
    };
    let haut = 0;
    while (haut < ah && rangeeSombre(haut)) haut++;
    let bas = ah;
    while (bas > haut && rangeeSombre(bas - 1)) bas--;
    let gauche = 0;
    while (gauche < aw && colonneSombre(gauche, haut, bas)) gauche++;
    let droite = aw;
    while (droite > gauche && colonneSombre(droite - 1, haut, bas)) droite--;
    if (haut > 0) haut++;
    if (bas < ah) bas--;
    if (gauche > 0) gauche++;
    if (droite < aw) droite--;
    // Une scène sombre n'est pas une bande : jamais sous un tiers de l'image.
    if (bas - haut < ah / 3 || droite - gauche < aw / 3) return null;
    return { x: gauche / aw, y: haut / ah, l: (droite - gauche) / aw, h: (bas - haut) / ah };
  };
  const memeCadre = (p, q) => p && q && ['x', 'y', 'l', 'h'].every((k) => Math.abs(p[k] - q[k]) < 0.001);
  const suivreCadre = (v) => {
    // YouTube garde le même élément d'une vidéo à l'autre : la source dit si on a changé.
    if (v.currentSrc !== a.sourceCadre) {
      a.sourceCadre = v.currentSrc;
      a.cadre = PLEIN_CADRE;
      a.candidat = null;
      a.releve = 0;
    }
    const maintenant = performance.now();
    if (maintenant - a.releve < 1000) return;
    a.releve = maintenant;
    const vu = releverCadre(v);
    if (!vu) return;
    // Retenu après deux relevés identiques.
    if (memeCadre(vu, a.candidat)) a.cadre = vu;
    a.candidat = vu;
  };

  const peindre = (v) => {
    if (!v.videoWidth || v.readyState < 2 || document.fullscreenElement) return;
    const { toile, ctx } = a;
    const L = toile.width;
    const H = toile.height;
    const k = L / innerWidth;
    const r = v.getBoundingClientRect();
    if (!r.width || !r.height) return;
    suivreCadre(v);
    const c = a.cadre;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const sx = c.x * vw;
    const sy = c.y * vh;
    const sw = c.l * vw;
    const sh = c.h * vh;
    const fit = Math.min(r.width / vw, r.height / vh);
    const ox = r.left + (r.width - vw * fit) / 2;
    const oy = r.top + (r.height - vh * fit) / 2;
    const x = (ox + sx * fit) * k;
    const y = (oy + sy * fit) * k;
    const w = sw * fit * k;
    const h = sh * fit * k;

    // Au loin : les bords de la miniature, étirés jusqu'à ceux de la page.
    const mini = a.miniature;
    const mw = MINIATURE;
    const mh = Math.max(3, Math.round((mw * sh) / sw));
    if (mini.c.width !== mw || mini.c.height !== mh) {
      mini.c.width = mw;
      mini.c.height = mh;
    }
    mini.ctx.drawImage(v, sx, sy, sw, sh, 0, 0, mw, mh);
    ctx.imageSmoothingQuality = 'high';
    const bloc = (bx, by, bl, bh, dx, dy, dl, dh) => {
      if (dl > 0 && dh > 0) ctx.drawImage(mini.c, bx, by, bl, bh, dx, dy, dl, dh);
    };
    const droite = x + w;
    const bas = y + h;
    bloc(0, 0, 1, mh, 0, y, x, h);
    bloc(mw - 1, 0, 1, mh, droite, y, L - droite, h);
    bloc(0, 0, mw, 1, x, 0, w, y);
    bloc(0, mh - 1, mw, 1, x, bas, w, H - bas);
    bloc(0, 0, 1, 1, 0, 0, x, y);
    bloc(mw - 1, 0, 1, 1, droite, 0, L - droite, y);
    bloc(0, mh - 1, 1, 1, 0, bas, x, H - bas);
    bloc(mw - 1, mh - 1, 1, 1, droite, bas, L - droite, H - bas);
    ctx.drawImage(mini.c, x, y, w, h);

    // Autour de l'image : la vidéo agrandie depuis son centre, fondue.
    const hw = w * HALO;
    const hh = h * HALO;
    const hx = x - (hw - w) / 2;
    const hy = y - (hh - h) / 2;
    preparerMasque(hx, hy, hw, hh);
    const halo = a.halo;
    halo.ctx.clearRect(0, 0, halo.c.width, halo.c.height);
    halo.ctx.drawImage(v, sx, sy, sw, sh, hx, hy, hw, hh);
    halo.ctx.globalCompositeOperation = 'destination-in';
    halo.ctx.drawImage(a.masque.c, 0, 0);
    halo.ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(halo.c, 0, 0);
  };

  // Au rythme de la vidéo, pas de l'écran : rien n'est redessiné en pause.
  const suivreImage = () => {
    const v = document.querySelector('#movie_player video');
    if (v === a.video) return;
    a.video = v;
    const generation = ++a.generation;
    if (!v) return;
    const aChaqueImage = () => {
      if (generation !== a.generation) return;
      peindre(v);
      v.requestVideoFrameCallback(aChaqueImage);
    };
    peindre(v);
    v.requestVideoFrameCallback(aChaqueImage);
  };

  const monter = () => {
    if (!a.boite) {
      const style = document.createElement('style');
      style.textContent = STYLE;
      const boite = document.createElement('div');
      boite.id = 'escale-ambiance';
      const toile = document.createElement('canvas');
      boite.appendChild(toile);
      // Sous `html` et non sous `body` : YouTube ne touche pas à ce qu'il n'a pas posé là.
      document.documentElement.append(style, boite);
      const analyse = document.createElement('canvas');
      Object.assign(a, {
        boite,
        toile,
        ctx: toile.getContext('2d', { alpha: false }),
        miniature: toileDeTravail(),
        halo: toileDeTravail(),
        masque: toileDeTravail(),
        analyse: { c: analyse, ctx: analyse.getContext('2d', { willReadFrequently: true }) }
      });
      ajusterToile();
      addEventListener('resize', ajusterToile);
      // Le lecteur défile avec la page : en pause, aucune image ne recalerait le fond.
      addEventListener('scroll', () => a.video && peindre(a.video), { passive: true });
    }
    document.documentElement.classList.add('escale-ambiance');
  };
  const demonter = () => {
    document.documentElement.classList.remove('escale-ambiance');
    a.video = null;
    a.generation++;
  };

  // Seulement sur une page de lecture ; YouTube change de page sans recharger
  // et remplace parfois l'élément vidéo : on revérifie chaque seconde.
  const suivre = () => {
    const voulu = a.actif && location.pathname === '/watch';
    const monte = document.documentElement.classList.contains('escale-ambiance');
    if (voulu && !monte) monter();
    else if (!voulu && monte) demonter();
    if (voulu) suivreImage();
  };
  setInterval(suivre, 1000);
  window.__escaleAmbiance = (actif) => {
    a.actif = Boolean(actif);
    suivre();
  };
}

/*
 * La bulle : sur YouTube, l'ambiance, le téléchargement et le saut des
 * sponsors vivent dans une bulle de verre posée dans la page (une vue native
 * couvre tout ce que le shell dessinerait par-dessus), sous un Shadow DOM fermé
 * que les styles de YouTube n'atteignent pas.
 *
 * Elle se comporte en bulle : on la saisit, on la lance, elle file, rebondit
 * sur les bords en s'écrasant, puis revient toujours se poser en bas à droite,
 * tirée par un ressort. Au repos, elle flotte et ondule.
 *
 * Elle ne parle pas au principal : elle range ses demandes dans une file que
 * le principal relève (`prendre`). Le monde isolé n'est pas joignable par les
 * scripts de YouTube, qui ne peuvent donc rien y glisser.
 */
function scriptBulle(L) {
  if (window.__escaleBulle) return;
  const file = [];
  const etat = { ambiance: false, sponsors: true, sortie: false, vue: null, video: null, toast: null };

  // YouTube impose les Trusted Types : pas d'innerHTML, tout se construit à la main.
  const NS = 'http://www.w3.org/2000/svg';
  const el = (nom, attrs = {}, enfants = [], ns) => {
    const e = ns ? document.createElementNS(ns, nom) : document.createElement(nom);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    for (const c of enfants) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
  };
  const trait = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const icone = (...d) => el('svg', { viewBox: '0 0 24 24', ...trait }, d.map((x) => el('path', { d: x }, [], NS)), NS);
  const ICONES = {
    logo: () =>
      el('svg', { viewBox: '0 0 24 24' }, [
        el('rect', { x: '11.4', y: '7.9', width: '1.2', height: '8.2', fill: 'currentColor', opacity: '.5' }, [], NS),
        el('circle', { cx: '12', cy: '6.6', r: '1.6', fill: 'none', stroke: 'currentColor', 'stroke-width': '1' }, [], NS),
        el('circle', { cx: '12', cy: '12', r: '2.5', fill: 'currentColor' }, [], NS),
        el('circle', { cx: '12', cy: '17.4', r: '1.6', fill: 'none', stroke: 'currentColor', 'stroke-width': '1' }, [], NS)
      ], NS),
    ambiance: () => icone('M9.94 14.06 4 20M14.5 3.5 16 7l3.5 1.5L16 10l-1.5 3.5L13 10 9.5 8.5 13 7z', 'M5 3v4M3 5h4M19 15v4M17 17h4'),
    telecharger: () => icone('M12 3v12M7 10l5 5 5-5M5 21h14'),
    sponsors: () => icone('M5 4l10 8-10 8z', 'M19 5v14'),
    retour: () => icone('M15 18l-6-6 6-6'),
    suite: () => icone('M9 18l6-6-6-6'),
    dossier: () => icone('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),
    sortir: () => icone('M14 3h7v7', 'M21 3l-8 8', 'M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5'),
    lecture: () => icone('M7 4l13 8-13 8z'),
    pause: () => icone('M8 4v16', 'M16 4v16'),
    son: () => icone('M11 5L6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'),
    rentrer: () => icone('M10 14L3 21', 'M3 14v7h7', 'M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5')
  };

  const STYLE = `
    :host { all: initial; position: fixed; z-index: 2147483000; left: 0; top: 0; width: 0; height: 0;
      font: 500 13px/1.25 "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    * { box-sizing: border-box; }
    .monde { --verre: rgba(255, 255, 255, 0.18); --verre-fort: rgba(255, 255, 255, 0.58); --bord: rgba(255, 255, 255, 0.55);
      --texte: #0f1115; --doux: rgba(15, 17, 21, 0.6); --ombre: rgba(15, 17, 21, 0.3); --survol: rgba(15, 17, 21, 0.06); }
    :host([sombre]) .monde { --verre: rgba(30, 32, 36, 0.32); --verre-fort: rgba(28, 30, 34, 0.68); --bord: rgba(255, 255, 255, 0.25);
      --texte: #f4f6f8; --doux: rgba(244, 246, 248, 0.62); --ombre: rgba(0, 0, 0, 0.6); --survol: rgba(255, 255, 255, 0.08); }

    /* La bulle : posée par le ressort (translate), déformée par la vitesse (forme). */
    .bulle { position: absolute; left: 0; top: 0; width: 56px; height: 56px; cursor: grab; touch-action: none; }
    .bulle:active { cursor: grabbing; }
    .forme { position: absolute; inset: 0; will-change: transform; }
    .flotte { position: absolute; inset: 0; animation: flotter 5.5s ease-in-out infinite; }
    .verre {
      position: absolute; inset: 0; overflow: hidden; color: var(--texte); display: grid; place-items: center;
      background: var(--verre);
      backdrop-filter: blur(16px) saturate(200%) brightness(1.05); -webkit-backdrop-filter: blur(16px) saturate(200%) brightness(1.05);
      box-shadow:
        inset 0 1.5px 1px rgba(255, 255, 255, 0.75), inset 0 -2px 6px rgba(255, 255, 255, 0.18),
        inset 0 0 0 1px var(--bord), 0 14px 30px -10px var(--ombre), 0 2px 6px -2px var(--ombre);
      animation: onduler 9s ease-in-out infinite;
    }
    /* Les irisations qui tournent sous le verre, comme sur une bulle de savon. */
    .verre::before {
      content: ''; position: absolute; inset: -40%; border-radius: 50%; opacity: .7; filter: blur(10px); mix-blend-mode: screen;
      background: conic-gradient(from 0deg, #1fb3a9, #59c3ff, #7c6cf2, #f29ec1, #ffd479, #1fb3a9);
      -webkit-mask: radial-gradient(circle, transparent 46%, #000 62%); mask: radial-gradient(circle, transparent 46%, #000 62%);
      animation: tourner 7s linear infinite;
    }
    /* Le reflet de lumière, en haut à gauche. */
    .verre::after {
      content: ''; position: absolute; left: 18%; top: 12%; width: 34%; height: 22%; border-radius: 50%;
      background: radial-gradient(closest-side, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0));
      transform: rotate(-28deg); pointer-events: none;
    }
    .logo { position: relative; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #fff;
      background: radial-gradient(circle at 35% 30%, #3fd1c6, #007a74 70%);
      box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.5), 0 3px 10px -3px rgba(0, 122, 116, 0.8); transition: transform .4s cubic-bezier(.34, 1.56, .64, 1); }
    .logo svg { width: 22px; height: 22px; }
    .bulle:hover .logo { transform: scale(1.08) rotate(-6deg); }
    .ouverte .logo { transform: scale(.92); }
    /* La progression d'un téléchargement, en anneau autour de la bulle. */
    .anneau { position: absolute; inset: -5px; width: 66px; height: 66px; transform: rotate(-90deg); pointer-events: none; opacity: 0; transition: opacity .3s; }
    .anneau.visible { opacity: 1; }
    .anneau circle { fill: none; stroke-width: 3; stroke-linecap: round; }
    .anneau .fond { stroke: rgba(255, 255, 255, 0.25); }
    .anneau .trace { stroke: #1fb3a9; stroke-dasharray: 189; stroke-dashoffset: 189; transition: stroke-dashoffset .35s; filter: drop-shadow(0 0 4px rgba(31, 179, 169, .7)); }
    .anneau.attente .trace { stroke-dashoffset: 140; animation: tourner 1s linear infinite; transform-origin: 33px 33px; }
    .pastille { position: absolute; right: -2px; top: -2px; width: 16px; height: 16px; border-radius: 50%; background: #1fb3a9; color: #fff;
      display: grid; place-items: center; transform: scale(0); transition: transform .45s cubic-bezier(.34, 1.56, .64, 1); box-shadow: 0 2px 6px rgba(0,0,0,.3); }
    .pastille.visible { transform: scale(1); }
    .pastille svg { width: 10px; height: 10px; stroke-width: 3; }

    @keyframes flotter { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, -3px); } }
    @keyframes onduler {
      0%, 100% { border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%; }
      25% { border-radius: 52% 48% 50% 50% / 48% 53% 47% 52%; }
      50% { border-radius: 48% 52% 53% 47% / 51% 48% 52% 49%; }
      75% { border-radius: 51% 49% 47% 53% / 53% 50% 50% 47%; }
    }
    @keyframes tourner { to { transform: rotate(360deg); } }

    /* Le panneau : il naît de la bulle et s'ouvre au-dessus, côté page. */
    .panneau {
      position: absolute; width: 248px; padding: 6px; border-radius: 22px; color: var(--texte);
      background: var(--verre-fort);
      backdrop-filter: blur(28px) saturate(190%); -webkit-backdrop-filter: blur(28px) saturate(190%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 0 0 1px var(--bord), 0 24px 48px -16px var(--ombre);
      transform-origin: var(--origine, 100% 100%); transform: scale(.35); opacity: 0; filter: blur(6px); pointer-events: none;
      transition: transform .5s cubic-bezier(.34, 1.56, .64, 1), opacity .25s, filter .3s;
    }
    .panneau.visible { transform: scale(1); opacity: 1; filter: none; pointer-events: auto; }
    .titre { display: flex; align-items: center; gap: 6px; padding: 8px 10px 6px; font-size: 11.5px; font-weight: 600; color: var(--doux); }
    button { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 14px;
      color: inherit; cursor: pointer; transition: background .2s, transform .15s; }
    button:hover { background: var(--survol); }
    button:active { transform: scale(.97); }
    button:disabled { opacity: .4; cursor: default; background: none; transform: none; }
    button svg { width: 17px; height: 17px; flex: none; }
    .libelle { flex: 1; }
    .ligne-retour { padding: 7px 8px; width: auto; }
    .interrupteur { width: 30px; height: 18px; border-radius: 9px; background: rgba(127, 127, 127, 0.35); position: relative; flex: none; transition: background .25s; }
    .interrupteur::after { content: ''; position: absolute; left: 2px; top: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform .35s cubic-bezier(.34, 1.56, .64, 1); }
    [aria-pressed="true"] .interrupteur { background: #1fb3a9; }
    [aria-pressed="true"] .interrupteur::after { transform: translateX(12px); }
    .etat { padding: 4px 10px 8px; font-size: 12px; color: var(--doux); }
    .barre { height: 4px; margin: 2px 10px 8px; border-radius: 2px; background: rgba(127, 127, 127, 0.25); overflow: hidden; }
    .barre div { height: 100%; width: 0; border-radius: 2px; background: #1fb3a9; transition: width .35s; }
    .erreur { color: #e5484d; }
    .vue { display: none; }
    .vue.active { display: block; animation: glisser .35s cubic-bezier(.34, 1.56, .64, 1); }
    @keyframes glisser { from { opacity: 0; transform: translateX(10px); } }

    /* Le message « Sponsor passé » : une capsule qui sort de la bulle. */
    .toast {
      position: absolute; display: flex; align-items: center; gap: 4px; height: 40px; padding: 0 6px 0 14px; border-radius: 20px; white-space: nowrap;
      color: var(--texte); background: var(--verre-fort);
      backdrop-filter: blur(24px) saturate(190%); -webkit-backdrop-filter: blur(24px) saturate(190%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 0 0 1px var(--bord), 0 16px 32px -14px var(--ombre);
      transform-origin: var(--origine, 100% 50%); transform: scale(.3); opacity: 0; pointer-events: none;
      transition: transform .5s cubic-bezier(.34, 1.56, .64, 1), opacity .25s;
    }
    .toast.visible { transform: scale(1); opacity: 1; pointer-events: auto; }
    .toast button { width: auto; padding: 7px 10px; border-radius: 14px; color: #1fb3a9; font-weight: 600; }
  `;

  const hote = document.createElement('div');
  const racine = hote.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = STYLE;

  // ---- la bulle ----
  const trace = el('circle', { class: 'trace', cx: '33', cy: '33', r: '30' }, [], NS);
  const anneau = el('svg', { class: 'anneau', viewBox: '0 0 66 66' }, [el('circle', { class: 'fond', cx: '33', cy: '33', r: '30' }, [], NS), trace], NS);
  const pastille = el('div', { class: 'pastille' }, [icone('M5 12l5 5L20 7')]);
  const forme = el('div', { class: 'forme' }, [el('div', { class: 'flotte' }, [el('div', { class: 'verre' }, [el('div', { class: 'logo' }, [ICONES.logo()])]), anneau, pastille])]);
  const bulle = el('div', { class: 'bulle', title: 'Escale' }, [forme]);

  // ---- le panneau ----
  const ligne = (ic, texte, attrs = {}, fin = null) => el('button', attrs, [ic, el('span', { class: 'libelle' }, [texte]), ...(fin ? [fin] : [])]);
  const bAmbiance = ligne(ICONES.ambiance(), L.ambiance, { 'aria-pressed': 'false' }, el('span', { class: 'interrupteur' }));
  const bSponsors = ligne(ICONES.sponsors(), L.sponsors, { 'aria-pressed': 'true' }, el('span', { class: 'interrupteur' }));
  const bTelecharger = ligne(ICONES.telecharger(), L.telecharger, {}, ICONES.suite());
  const etatTexte = el('div', { class: 'etat' });
  const barreRemplie = el('div');
  const barre = el('div', { class: 'barre' }, [barreRemplie]);
  const bDossier = ligne(ICONES.dossier(), L.afficher);
  const blocTelechargement = el('div', {}, [etatTexte, barre, bDossier]);
  const bSortir = ligne(ICONES.sortir(), L.sortir);
  const vueMenu = el('div', { class: 'vue active' }, [el('div', { class: 'titre' }, ['Escale']), bSortir, bAmbiance, bSponsors, bTelecharger, blocTelechargement]);
  const bRetour = el('button', { class: 'ligne-retour' }, [ICONES.retour(), el('span', {}, [L.telecharger])]);
  const formats = L.formats.map(([id, texte]) => {
    if (!id) return el('div', { style: 'height:1px;margin:4px 10px;background:rgba(127,127,127,.25)' });
    const b = ligne(ICONES.telecharger(), texte);
    b.addEventListener('click', () => {
      file.push({ type: 'telecharger', format: id });
      montrer('menu');
    });
    return b;
  });
  const vueFormats = el('div', { class: 'vue' }, [bRetour, ...formats]);
  const panneau = el('div', { class: 'panneau' }, [vueMenu, vueFormats]);

  // ---- le message ----
  const toastTexte = el('span');
  const bRevenir = el('button', {}, [L.revenir]);
  const toast = el('div', { class: 'toast' }, [toastTexte, bRevenir]);

  const monde = el('div', { class: 'monde' }, [panneau, toast, bulle]);
  racine.append(style, monde);

  const estVideo = () => (location.pathname === '/watch' && new URLSearchParams(location.search).has('v')) || location.pathname.startsWith('/shorts/');
  const TAILLE = 56;
  const MARGE = 24;
  const maison = () => ({ x: innerWidth - TAILLE - MARGE, y: innerHeight - TAILLE - MARGE });
  let pos = maison();
  let vit = { x: 0, y: 0 };
  let phase = 'repos'; // repos | tenue | vol | retour
  let tempsVol = 0;
  // L'écrasement au choc : un petit ressort à part, qui oscille et s'éteint.
  let choc = { v: 0, x: 0, angle: 0 };

  // ---- le dessin ----
  const peindre = () => {
    bulle.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    const vitesse = Math.hypot(vit.x, vit.y);
    const etire = phase === 'repos' ? 0 : Math.min(vitesse / 2600, 0.24);
    const angleVit = Math.atan2(vit.y, vit.x);
    const sx = 1 + etire - choc.x * 0.5;
    const sy = 1 / (1 + etire) + choc.x * 0.5;
    const a = etire > choc.x ? angleVit : choc.angle;
    forme.style.transform = `rotate(${a}rad) scale(${sx}, ${sy}) rotate(${-a}rad)`;
    placerVoisins();
  };

  // Panneau et message s'ouvrent du côté où il y a la place.
  const placerVoisins = () => {
    const gauche = pos.x + TAILLE / 2 > innerWidth / 2;
    const haut = pos.y + TAILLE / 2 > innerHeight / 2;
    const ph = panneau.offsetHeight || 220;
    const px = gauche ? pos.x + TAILLE - 248 : pos.x;
    const py = haut ? pos.y - ph - 10 : pos.y + TAILLE + 10;
    panneau.style.left = `${Math.max(8, Math.min(px, innerWidth - 256))}px`;
    panneau.style.top = `${Math.max(8, py)}px`;
    panneau.style.setProperty('--origine', `${gauche ? '100%' : '0%'} ${haut ? '100%' : '0%'}`);
    const tl = toast.offsetWidth || 200;
    toast.style.left = `${gauche ? pos.x - tl - 10 : pos.x + TAILLE + 10}px`;
    toast.style.top = `${pos.y + 8}px`;
    toast.style.setProperty('--origine', `${gauche ? '100%' : '0%'} 50%`);
  };

  // ---- la physique ----
  let dernier = 0;
  let boucle = 0;
  const animer = (t) => {
    const dt = Math.min(0.033, dernier ? (t - dernier) / 1000 : 0.016);
    dernier = t;
    const m = maison();
    const limite = { x: innerWidth - TAILLE - 6, y: innerHeight - TAILLE - 6 };
    if (phase === 'vol') {
      tempsVol += dt;
      const frein = Math.exp(-2.2 * dt);
      vit.x *= frein;
      vit.y *= frein;
      pos.x += vit.x * dt;
      pos.y += vit.y * dt;
      // Les bords de la page : la bulle rebondit et s'écrase contre eux.
      const heurter = (axe, angle) => {
        const force = Math.min(Math.abs(vit[axe]) / 2200, 0.32);
        vit[axe] = -vit[axe] * 0.62;
        if (force > 0.02) choc = { v: -force * 18, x: force, angle };
      };
      if (pos.x < 6) { pos.x = 6; heurter('x', 0); }
      if (pos.x > limite.x) { pos.x = limite.x; heurter('x', 0); }
      if (pos.y < 6) { pos.y = 6; heurter('y', Math.PI / 2); }
      if (pos.y > limite.y) { pos.y = limite.y; heurter('y', Math.PI / 2); }
      if (Math.hypot(vit.x, vit.y) < 220 || tempsVol > 1.1) phase = 'retour';
    } else if (phase === 'retour') {
      // Un ressort un peu souple : la bulle dépasse sa place, puis s'y pose.
      const k = 70;
      const c = 10.5;
      vit.x += (k * (m.x - pos.x) - c * vit.x) * dt;
      vit.y += (k * (m.y - pos.y) - c * vit.y) * dt;
      pos.x += vit.x * dt;
      pos.y += vit.y * dt;
      if (Math.hypot(m.x - pos.x, m.y - pos.y) < 0.4 && Math.hypot(vit.x, vit.y) < 4) {
        pos = m;
        vit = { x: 0, y: 0 };
        phase = 'repos';
      }
    }
    // Le choc s'amortit en oscillant, comme une goutte.
    choc.v += (-320 * choc.x - 9 * choc.v) * dt;
    choc.x += choc.v * dt;
    if (Math.abs(choc.x) < 0.002 && Math.abs(choc.v) < 0.02) choc = { v: 0, x: 0, angle: choc.angle };
    peindre();
    const finie = phase === 'repos' && choc.x === 0;
    boucle = finie ? 0 : requestAnimationFrame(animer);
  };
  const relancer = () => {
    if (boucle) return;
    dernier = 0;
    boucle = requestAnimationFrame(animer);
  };

  // ---- saisir et lancer ----
  let prise = null;
  bulle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    bulle.setPointerCapture(e.pointerId);
    prise = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, x0: e.clientX, y0: e.clientY, bouge: false, traces: [{ x: e.clientX, y: e.clientY, t: performance.now() }] };
    vit = { x: 0, y: 0 };
  });
  bulle.addEventListener('pointermove', (e) => {
    if (!prise) return;
    if (!prise.bouge && Math.hypot(e.clientX - prise.x0, e.clientY - prise.y0) < 5) return;
    if (!prise.bouge) {
      prise.bouge = true;
      montrer(null);
      phase = 'tenue';
      if (boucle) cancelAnimationFrame(boucle);
      boucle = 0;
    }
    const t = performance.now();
    prise.traces.push({ x: e.clientX, y: e.clientY, t });
    while (prise.traces.length > 2 && t - prise.traces[0].t > 90) prise.traces.shift();
    const p0 = prise.traces[0];
    const dtt = Math.max(0.008, (t - p0.t) / 1000);
    vit = { x: (e.clientX - p0.x) / dtt, y: (e.clientY - p0.y) / dtt };
    pos = { x: e.clientX - prise.dx, y: e.clientY - prise.dy };
    peindre();
  });
  const lacher = () => {
    if (!prise) return;
    const bouge = prise.bouge;
    prise = null;
    if (!bouge) {
      montrer(etat.vue ? null : 'menu');
      return;
    }
    // Lancée : l'élan des derniers instants, plafonné.
    const v = Math.hypot(vit.x, vit.y);
    const plafond = 4200;
    if (v > plafond) vit = { x: (vit.x / v) * plafond, y: (vit.y / v) * plafond };
    phase = v > 250 ? 'vol' : 'retour';
    tempsVol = 0;
    relancer();
  };
  bulle.addEventListener('pointerup', lacher);
  bulle.addEventListener('pointercancel', lacher);

  // ---- panneau ----
  const montrer = (vue) => {
    etat.vue = vue;
    panneau.classList.toggle('visible', Boolean(vue));
    bulle.classList.toggle('ouverte', Boolean(vue));
    vueMenu.classList.toggle('active', vue !== 'formats');
    vueFormats.classList.toggle('active', vue === 'formats');
    rafraichir();
    requestAnimationFrame(placerVoisins);
  };
  bAmbiance.addEventListener('click', () => file.push({ type: 'ambiance' }));
  bSponsors.addEventListener('click', () => file.push({ type: 'sponsors' }));
  bTelecharger.addEventListener('click', () => montrer('formats'));
  bSortir.addEventListener('click', () => {
    montrer(null);
    file.push({ type: 'sortir' });
  });
  bRetour.addEventListener('click', () => montrer('menu'));
  bDossier.addEventListener('click', () => {
    if (etat.video) file.push({ type: 'montrer', id: etat.video.id });
  });
  // Un clic ailleurs dans la page referme le panneau.
  document.addEventListener('pointerdown', (e) => {
    if (etat.vue && !e.composedPath().includes(hote)) montrer(null);
  }, true);

  const rafraichir = () => {
    bAmbiance.setAttribute('aria-pressed', String(etat.ambiance));
    bAmbiance.disabled = location.pathname !== '/watch';
    bSponsors.setAttribute('aria-pressed', String(etat.sponsors));
    bTelecharger.disabled = !estVideo();
    bSortir.disabled = location.pathname !== '/watch' || !document.querySelector('#movie_player video');
    const v = etat.video;
    blocTelechargement.style.display = v ? '' : 'none';
    if (v) {
      const enCours = v.etat === 'prepare' || v.etat === 'en-cours';
      const p = v.total > 0 ? Math.min(100, Math.round(((v.recu || 0) / v.total) * 100)) : null;
      etatTexte.className = 'etat' + (v.etat === 'echec' ? ' erreur' : '');
      etatTexte.textContent = v.etat === 'prepare' ? (v.detail || L.preparation)
        : v.etat === 'en-cours' ? (p === null ? L.enCours : `${L.enCours} ${p} %`)
        : v.etat === 'fini' ? L.termine
        : (v.erreur || L.echec);
      barre.style.display = enCours ? '' : 'none';
      barreRemplie.style.width = `${p ?? 15}%`;
      bDossier.style.display = v.etat === 'fini' ? '' : 'none';
      anneau.classList.toggle('visible', enCours);
      anneau.classList.toggle('attente', enCours && p === null);
      trace.style.strokeDashoffset = String(189 - (189 * (p ?? 0)) / 100);
    } else {
      anneau.classList.remove('visible');
    }
    if (document.documentElement.hasAttribute('dark')) hote.setAttribute('sombre', '');
    else hote.removeAttribute('sombre');
    // Rien par-dessus une vidéo en plein écran.
    hote.style.display = document.fullscreenElement ? 'none' : '';
  };

  // ---- message éphémère ----
  let minuteurToast = 0;
  const annoncer = (texte, revenir) => {
    toastTexte.textContent = texte;
    bRevenir.style.display = revenir ? '' : 'none';
    bRevenir.onclick = () => {
      if (revenir) revenir();
      toast.classList.remove('visible');
    };
    toast.classList.add('visible');
    // Un petit sursaut de la bulle, qui accompagne le message.
    choc = { v: -5, x: 0.06, angle: 0 };
    relancer();
    requestAnimationFrame(placerVoisins);
    clearTimeout(minuteurToast);
    minuteurToast = setTimeout(() => toast.classList.remove('visible'), 8000);
  };

  // ---- sponsors (SponsorBlock) et publicités ----
  let passages = { id: null, liste: [], faits: new Set() };
  const idVideo = () => new URLSearchParams(location.search).get('v') || null;
  // Chaque passage n'est sauté qu'une fois : revenir en arrière, c'est l'avoir choisi.
  // Jamais pendant une publicité ni en pause.
  window.addEventListener('timeupdate', (e) => {
    const v = e.target;
    if (!etat.sponsors || !passages.liste.length || !v || v.tagName !== 'VIDEO') return;
    if (v.paused || !v.closest('#movie_player') || document.querySelector('#movie_player.ad-showing')) return;
    const t = v.currentTime;
    const saut = passages.liste.find((p) => !passages.faits.has(p.id) && t >= p.debut && t < p.fin - 0.5);
    if (!saut) return;
    passages.faits.add(saut.id);
    v.currentTime = Number.isFinite(v.duration) ? Math.min(saut.fin, v.duration) : saut.fin;
    annoncer(saut.categorie === 'selfpromo' ? L.autopromo : L.sponsor, () => {
      v.currentTime = saut.debut;
    });
  }, true);

  // Le bouton « Ignorer » d'une publicité : YouTube refuse un clic fabriqué par
  // script, le principal envoie un vrai clic à cet endroit (voir CLAUDE.md de
  // Hublink). Un bouton, jamais un conteneur.
  let pubSignalee = 0;
  const boutonIgnorer = () => {
    // Sortie en mode vidéo, la page est masquée et l'image couvre le bouton :
    // un clic à sa place tomberait sur la vidéo.
    if (etat.sortie) return null;
    if (!etat.sponsors || !document.querySelector('#movie_player.ad-showing')) return null;
    const b = document.querySelector('#movie_player button.ytp-skip-ad-button, #movie_player .ytp-ad-skip-button-modern, #movie_player .ytp-ad-skip-button');
    if (!b || !b.checkVisibility || !b.checkVisibility()) return null;
    const r = b.getBoundingClientRect();
    if (!r.width || !r.height || performance.now() - pubSignalee < 1500) return null;
    pubSignalee = performance.now();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  };

  // ---- vie de la page ----
  const poser = () => {
    if (!hote.isConnected) document.documentElement.appendChild(hote);
    rafraichir();
  };
  addEventListener('resize', () => {
    if (phase === 'repos') pos = maison();
    peindre();
  });
  document.addEventListener('fullscreenchange', rafraichir);
  // YouTube change de page sans recharger : boutons et thème se revérifient.
  setInterval(poser, 1000);
  poser();
  peindre();

  // ---- mode vidéo : la page sortie dans sa petite fenêtre (videomode.js) ----
  // La page n'est pas remaniée : tout devient invisible, la vidéo repasse
  // visible et fixée sur toute la fenêtre. Déplacer l'élément dans le DOM ne
  // tiendrait pas : YouTube le remet aussitôt en place (Hublink).
  const styleSortie = document.createElement('style');
  styleSortie.textContent = `
    html.escale-sortie, html.escale-sortie body { background: #000 !important; overflow: hidden !important; }
    html.escale-sortie body * { visibility: hidden !important; }
    html.escale-sortie #movie_player video.html5-main-video {
      visibility: visible !important; position: fixed !important; inset: 0 !important; left: 0 !important; top: 0 !important;
      width: 100vw !important; height: 100vh !important; object-fit: contain !important; transform: none !important;
      z-index: 2147482000 !important; background: #000 !important;
    }
    html.escale-sortie #escale-ambiance { display: none !important; }
  `;
  const STYLE_COMMANDES = `
    .commandes { position: fixed; left: 0; right: 0; bottom: 0; top: 0; pointer-events: none; opacity: 0; transition: opacity .25s; display: none; }
    .sortie .commandes { display: block; }
    .commandes.visibles { opacity: 1; }
    .poignee { position: absolute; left: 0; right: 0; top: 0; height: 40px; pointer-events: auto; cursor: grab;
      background: linear-gradient(rgba(0, 0, 0, .45), transparent); }
    .poignee:active { cursor: grabbing; }
    .barre-video {
      position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; padding: 5px;
      border-radius: 999px; pointer-events: auto; color: #fff;
      background: rgba(20, 22, 26, 0.42); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.14), 0 10px 30px -10px rgba(0, 0, 0, .7);
    }
    .barre-video button { width: auto; padding: 8px; border-radius: 999px; color: #fff; }
    .barre-video button:hover { background: rgba(255, 255, 255, 0.14); }
    .barre-video input { width: 84px; accent-color: #1fb3a9; }
    .sortie .bulle, .sortie .panneau, .sortie .toast { display: none !important; }
  `;
  const styleCommandes = document.createElement('style');
  styleCommandes.textContent = STYLE_COMMANDES;
  racine.append(styleCommandes);
  const bLecture = el('button', { title: L.lecture }, [ICONES.pause()]);
  const volume = el('input', { type: 'range', min: '0', max: '100', value: '100', title: L.volume });
  const bRentrer = el('button', { title: L.rentrer }, [ICONES.rentrer()]);
  const poignee = el('div', { class: 'poignee', title: L.deplacer });
  const commandes = el('div', { class: 'commandes' }, [poignee, el('div', { class: 'barre-video' }, [bLecture, el('span', { style: 'display:flex;padding:0 2px' }, [ICONES.son()]), volume, bRentrer])]);
  monde.append(commandes);

  const videoPrincipale = () => document.querySelector('#movie_player video.html5-main-video') || document.querySelector('#movie_player video');
  const iconeLecture = () => {
    const v = videoPrincipale();
    bLecture.replaceChildren(v && !v.paused ? ICONES.pause() : ICONES.lecture());
  };
  // Les commandes ne paraissent qu'au survol, et restent tant que la vidéo est en pause.
  let minuteurCommandes = 0;
  const reveiller = () => {
    if (!etat.sortie) return;
    commandes.classList.add('visibles');
    iconeLecture();
    clearTimeout(minuteurCommandes);
    minuteurCommandes = setTimeout(() => {
      const v = videoPrincipale();
      if (v && !v.paused) commandes.classList.remove('visibles');
    }, 2200);
  };
  document.addEventListener('mousemove', reveiller, true);
  document.addEventListener('mouseleave', () => {
    const v = videoPrincipale();
    if (v && !v.paused) commandes.classList.remove('visibles');
  });
  window.addEventListener('play', iconeLecture, true);
  window.addEventListener('pause', () => {
    iconeLecture();
    reveiller();
  }, true);
  bLecture.addEventListener('click', () => file.push({ type: 'lecture' }));
  volume.addEventListener('input', () => file.push({ type: 'son', valeur: Number(volume.value) }));
  bRentrer.addEventListener('click', () => file.push({ type: 'rentrer' }));
  // Le déplacement passe par le principal, qui suit le pointeur : la fenêtre ne
  // prend jamais le premier plan, une zone « drag » n'y suffirait pas.
  poignee.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    poignee.setPointerCapture(e.pointerId);
    file.push({ type: 'glisser', actif: true });
  });
  const finGlisser = () => file.push({ type: 'glisser', actif: false });
  poignee.addEventListener('pointerup', finGlisser);
  poignee.addEventListener('pointercancel', finGlisser);

  window.__escaleBulle = {
    sortie: (actif, son) => {
      etat.sortie = Boolean(actif);
      if (etat.sortie && !styleSortie.isConnected) document.documentElement.append(styleSortie);
      document.documentElement.classList.toggle('escale-sortie', etat.sortie);
      monde.classList.toggle('sortie', etat.sortie);
      if (Number.isFinite(son)) volume.value = String(son);
      montrer(null);
      if (etat.sortie) reveiller();
    },
    prendre: () => ({ demandes: file.splice(0), video: idVideo(), pub: boutonIgnorer() }),
    ambiance: (actif) => {
      etat.ambiance = Boolean(actif);
      rafraichir();
    },
    sponsors: (actif) => {
      etat.sponsors = Boolean(actif);
      passages = { id: null, liste: [], faits: new Set() };
      rafraichir();
    },
    passages: (id, liste) => {
      if (id === idVideo()) passages = { id, liste: Array.isArray(liste) ? liste : [], faits: new Set() };
    },
    video: (e) => {
      const avant = etat.video;
      etat.video = e;
      rafraichir();
      if (e.etat === 'fini' && avant?.etat !== 'fini') {
        pastille.classList.add('visible');
        annoncer(L.termine, null);
        setTimeout(() => pastille.classList.remove('visible'), 4000);
      }
      if (e.etat === 'echec' && avant?.etat !== 'echec') annoncer(e.erreur || L.echec, null);
    }
  };
}

const CODE = `(${scriptAmbiance.toString()})();`;
const codeBulle = (libelles) => `(${scriptBulle.toString()})(${JSON.stringify(libelles)});`;
const ia = (v) => (v ? 'true' : 'false');

/** Pose (une fois par document) puis règle l'ambiance et la bulle d'une page YouTube. */
function appliquer(wc, reglages, libelles) {
  if (wc.isDestroyed() || !surYouTube(wc.getURL())) return;
  const code = [
    CODE,
    `window.__escaleAmbiance(${ia(reglages.ambiance)});`,
    libelles ? codeBulle(libelles) : '',
    `if (window.__escaleBulle) { window.__escaleBulle.ambiance(${ia(reglages.ambiance)}); window.__escaleBulle.sponsors(${ia(reglages.sponsors)}); }`
  ].join('\n');
  wc.executeJavaScriptInIsolatedWorld(MONDE, [{ code }]).catch(() => {});
}

/** Transmet à la bulle l'état d'un téléchargement lancé depuis elle. */
function signalerVideo(wc, e) {
  if (wc.isDestroyed()) return;
  wc.executeJavaScriptInIsolatedWorld(MONDE, [{ code: `window.__escaleBulle && window.__escaleBulle.video(${JSON.stringify(e)});` }]).catch(() => {});
}

/**
 * À chaque page YouTube : ambiance et bulle suivent les réglages, et les
 * demandes de la bulle sont relevées tant que la page est sur YouTube.
 * `o` : { reglages(), libelles(), basculer(cle), telecharger(wc, format), montrer(id), passages(idVideo) }.
 */
// Le lecteur YouTube, dans le monde de la page : le son et la lecture passent
// par lui, jamais par l'élément vidéo, que YouTube réajuste à chaque pub.
const LECTEUR = "document.getElementById('movie_player')";
const basculerLecture = `(p => p && (p.getPlayerState() === 1 ? p.pauseVideo() : p.playVideo()))(${LECTEUR})`;
const reglerSon = (v) => `(p => { if (!p) return; p.unMute(); p.setVolume(${Math.max(0, Math.min(100, Math.round(v)))}); })(${LECTEUR})`;
const lireSon = `(p => (p && p.getVolume ? (p.isMuted() ? 0 : p.getVolume()) : 100))(${LECTEUR})`;

/** Passe la page en mode vidéo (vidéo seule, commandes au survol) ou l'en sort. */
async function poserSortie(wc, actif) {
  if (wc.isDestroyed()) return;
  const son = actif ? await wc.executeJavaScript(lireSon).catch(() => 100) : null;
  wc.executeJavaScriptInIsolatedWorld(MONDE, [{ code: `window.__escaleBulle && window.__escaleBulle.sortie(${ia(actif)}, ${Number(son) || 0});` }]).catch(() => {});
}

/**
 * À chaque page YouTube : ambiance et bulle suivent les réglages, et les
 * demandes de la bulle sont relevées tant que la page est sur YouTube — plus
 * souvent quand elle est sortie en mode vidéo, où l'on glisse la fenêtre.
 * `o` : { reglages(), libelles(), basculer(cle), telecharger(wc, format), montrer(id),
 *         passages(idVideo), sortir(wc), rentrer(wc), glisser(actif), estSortie(wc) }.
 */
function brancher(wc, o) {
  wc.on('dom-ready', () => appliquer(wc, o.reglages(), o.libelles()));
  let videoVue = null;
  const relever = async () => {
    if (wc.isDestroyed()) return;
    if (surYouTube(wc.getURL())) await releverUneFois();
    setTimeout(relever, o.estSortie(wc) ? 50 : 300);
  };
  const releverUneFois = async () => {
    const r = await wc
      .executeJavaScriptInIsolatedWorld(MONDE, [{ code: 'window.__escaleBulle ? window.__escaleBulle.prendre() : null' }])
      .catch(() => null);
    if (!r || wc.isDestroyed()) return;
    for (const d of Array.isArray(r.demandes) ? r.demandes : []) {
      if (d?.type === 'ambiance') o.basculer('ambiance');
      if (d?.type === 'sponsors') o.basculer('sponsors');
      if (d?.type === 'telecharger' && typeof d.format === 'string') o.telecharger(wc, d.format);
      if (d?.type === 'montrer' && typeof d.id === 'string') o.montrer(d.id);
      if (d?.type === 'sortir') o.sortir(wc);
      if (d?.type === 'rentrer') o.rentrer(wc);
      if (d?.type === 'glisser') o.glisser(Boolean(d.actif));
      if (d?.type === 'lecture') wc.executeJavaScript(basculerLecture).catch(() => {});
      if (d?.type === 'son' && Number.isFinite(d.valeur)) wc.executeJavaScript(reglerSon(d.valeur)).catch(() => {});
    }
    // Nouvelle vidéo : ses passages sponsorisés, si le réglage le veut.
    if (r.video !== videoVue) {
      videoVue = r.video;
      if (videoVue && o.reglages().sponsors) {
        const liste = await o.passages(videoVue);
        if (!wc.isDestroyed()) {
          wc.executeJavaScriptInIsolatedWorld(MONDE, [{ code: `window.__escaleBulle && window.__escaleBulle.passages(${JSON.stringify(videoVue)}, ${JSON.stringify(liste)});` }]).catch(() => {});
        }
      }
    }
    // « Ignorer » une publicité : un vrai clic, YouTube refusant ceux d'un script.
    const p = r.pub;
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      wc.sendInputEvent({ type: 'mouseDown', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      wc.sendInputEvent({ type: 'mouseUp', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    }
  };
  relever();
}

module.exports = { brancher, appliquer, signalerVideo, surYouTube, poserSortie };
