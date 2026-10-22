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
 * La bulle : sur YouTube, l'ambiance et le téléchargement vivent dans une
 * pastille flottante de verre dépoli, que l'on déplace où l'on veut, plutôt
 * que dans la barre d'Escale. Elle est dans la page (une vue native couvre
 * tout ce que le shell dessinerait par-dessus), sous un Shadow DOM fermé pour
 * que les styles de YouTube ne l'atteignent pas.
 *
 * Elle ne parle pas au principal : elle range ses demandes dans une file que
 * le principal relève (`prendre`). Le monde isolé n'est pas joignable par les
 * scripts de YouTube, qui ne peuvent donc rien y glisser.
 */
function scriptBulle(libelles) {
  if (window.__escaleBulle) return;
  const file = [];
  const etat = { ambiance: false, ouverte: false };
  const CLE = 'escale-bulle';
  // YouTube impose les Trusted Types : pas d'innerHTML, tout se construit à la main.
  const NS = 'http://www.w3.org/2000/svg';
  const el = (nom, attrs = {}, enfants = [], ns) => {
    const e = ns ? document.createElementNS(ns, nom) : document.createElement(nom);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    for (const c of enfants) e.append(c);
    return e;
  };
  const trait = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const ICONES = {
    logo: () =>
      el('svg', { viewBox: '0 0 24 24' }, [
        el('rect', { x: '11.4', y: '7.9', width: '1.2', height: '8.2', fill: 'currentColor', opacity: '.5' }, [], NS),
        el('circle', { cx: '12', cy: '6.6', r: '1.6', fill: 'none', stroke: 'currentColor', 'stroke-width': '1' }, [], NS),
        el('circle', { cx: '12', cy: '12', r: '2.5', fill: 'currentColor' }, [], NS),
        el('circle', { cx: '12', cy: '17.4', r: '1.6', fill: 'none', stroke: 'currentColor', 'stroke-width': '1' }, [], NS)
      ], NS),
    ambiance: () =>
      el('svg', { viewBox: '0 0 24 24', ...trait }, [
        el('path', { d: 'M9.94 14.06 4 20M14.5 3.5 16 7l3.5 1.5L16 10l-1.5 3.5L13 10 9.5 8.5 13 7z' }, [], NS),
        el('path', { d: 'M5 3v4M3 5h4M19 15v4M17 17h4' }, [], NS)
      ], NS),
    telecharger: () => el('svg', { viewBox: '0 0 24 24', ...trait }, [el('path', { d: 'M12 3v12M7 10l5 5 5-5M5 21h14' }, [], NS)], NS)
  };
  const STYLE = `
    :host { all: initial; position: fixed; z-index: 2147483000; left: 0; top: 0; font: 500 13px/1 "Segoe UI", system-ui, sans-serif; }
    .bulle {
      --verre: rgba(255, 255, 255, 0.16); --bord: rgba(255, 255, 255, 0.45); --texte: #0f1115; --ombre: rgba(15, 17, 21, 0.28);
      position: relative; display: flex; align-items: center; gap: 2px; height: 48px; min-width: 48px; padding: 0 4px;
      box-sizing: border-box; border-radius: 999px; color: var(--texte); cursor: grab; user-select: none; overflow: hidden;
      background: var(--verre);
      backdrop-filter: blur(22px) saturate(190%); -webkit-backdrop-filter: blur(22px) saturate(190%);
      box-shadow: inset 0 1px 0 var(--bord), inset 0 -1px 0 rgba(255, 255, 255, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.18), 0 12px 32px -8px var(--ombre);
      transition: padding .45s cubic-bezier(.34, 1.56, .64, 1), transform .35s cubic-bezier(.34, 1.56, .64, 1);
      animation: entree .6s cubic-bezier(.34, 1.56, .64, 1) both;
    }
    :host([sombre]) .bulle { --verre: rgba(28, 30, 34, 0.38); --bord: rgba(255, 255, 255, 0.22); --texte: #f4f6f8; --ombre: rgba(0, 0, 0, 0.55); }
    /* Le reflet : un dégradé maillé qui tourne lentement sous le verre. */
    .bulle::before {
      content: ''; position: absolute; inset: -60%; z-index: -1; opacity: .55; filter: blur(14px);
      background:
        radial-gradient(closest-side at 30% 35%, #1fb3a9, transparent 70%),
        radial-gradient(closest-side at 70% 30%, #7c6cf2, transparent 70%),
        radial-gradient(closest-side at 55% 75%, #f29ec1, transparent 70%),
        radial-gradient(closest-side at 25% 75%, #59c3ff, transparent 70%);
      animation: maille 14s linear infinite;
    }
    .bulle::after {
      content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0) 55%);
      mix-blend-mode: soft-light;
    }
    .bulle:active { cursor: grabbing; }
    .bulle.glisse { transform: scale(1.06); transition: transform .2s; }
    @keyframes maille { to { transform: rotate(360deg); } }
    @keyframes entree { from { opacity: 0; transform: scale(.6) translateY(12px); } }
    .logo {
      width: 38px; height: 38px; margin: 0 1px; flex: none; display: grid; place-items: center; border-radius: 999px; color: #fff;
      background: linear-gradient(180deg, #1fb3a9, #007a74);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 8px -2px rgba(0, 122, 116, 0.6);
    }
    .logo svg { width: 24px; height: 24px; }
    .actions { display: flex; align-items: center; gap: 2px; max-width: 0; opacity: 0; overflow: hidden;
      transition: max-width .5s cubic-bezier(.34, 1.56, .64, 1), opacity .25s; }
    .ouverte .actions { max-width: 320px; opacity: 1; }
    .ouverte { padding-right: 6px; }
    button {
      all: unset; display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border-radius: 999px;
      color: inherit; cursor: pointer; white-space: nowrap; transition: background .2s, opacity .2s;
    }
    button:hover { background: rgba(255, 255, 255, 0.22); }
    :host([sombre]) button:hover { background: rgba(255, 255, 255, 0.1); }
    button svg { width: 16px; height: 16px; flex: none; }
    button[aria-pressed="true"] { background: rgba(31, 179, 169, 0.28); }
    button[aria-pressed="true"] svg { color: #1fb3a9; }
    button:disabled { opacity: .4; cursor: default; background: none; }
  `;

  const hote = document.createElement('div');
  const racine = hote.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = STYLE;
  const libelle = (texte) => {
    const s = document.createElement('span');
    s.textContent = texte;
    return s;
  };
  const bAmbiance = el('button', { class: 'ambiance', 'aria-pressed': 'false' }, [ICONES.ambiance(), libelle(libelles.ambiance)]);
  const bTelecharger = el('button', { class: 'telecharger' }, [ICONES.telecharger(), libelle(libelles.telecharger)]);
  const bulle = el('div', { class: 'bulle' }, [
    el('div', { class: 'logo', title: 'Escale' }, [ICONES.logo()]),
    el('div', { class: 'actions' }, [bAmbiance, bTelecharger])
  ]);
  racine.append(style, bulle);

  const estVideo = () => (location.pathname === '/watch' && new URLSearchParams(location.search).has('v')) || location.pathname.startsWith('/shorts/');
  const rafraichir = () => {
    bulle.classList.toggle('ouverte', etat.ouverte);
    bAmbiance.setAttribute('aria-pressed', String(etat.ambiance));
    bAmbiance.disabled = location.pathname !== '/watch';
    bTelecharger.disabled = !estVideo();
    if (document.documentElement.hasAttribute('dark')) hote.setAttribute('sombre', '');
    else hote.removeAttribute('sombre');
    // Rien par-dessus une vidéo en plein écran.
    hote.style.display = document.fullscreenElement ? 'none' : '';
  };

  // Position : retenue d'une visite à l'autre, gardée dans la fenêtre.
  let pos = { x: innerWidth - 96, y: innerHeight - 120 };
  try {
    const lu = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (lu && Number.isFinite(lu.x) && Number.isFinite(lu.y)) pos = lu;
  } catch {
    // Stockage refusé : position par défaut.
  }
  // La bulle ouverte s'élargit : près du bord droit, elle glisse vers la gauche
  // pour rester entière (`affiche`), sans perdre la place choisie (`pos`).
  const placer = () => {
    const r = bulle.getBoundingClientRect();
    pos.x = Math.min(Math.max(8, pos.x), innerWidth - 56);
    pos.y = Math.min(Math.max(8, pos.y), innerHeight - 56);
    const x = Math.min(pos.x, innerWidth - Math.max(48, r.width) - 8);
    hote.style.transform = `translate(${x}px, ${pos.y}px)`;
  };
  hote.style.transition = 'transform .45s cubic-bezier(.34, 1.56, .64, 1)';
  bulle.addEventListener('transitionend', placer);

  // Glisser partout, sauf depuis un bouton ; un clic sans déplacement ouvre ou referme.
  let depart = null;
  bulle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    depart = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, bouge: false };
    bulle.setPointerCapture(e.pointerId);
  });
  bulle.addEventListener('pointermove', (e) => {
    if (!depart) return;
    const dx = e.clientX - depart.x;
    const dy = e.clientY - depart.y;
    if (!depart.bouge && Math.hypot(dx, dy) < 4) return;
    depart.bouge = true;
    // Sous le doigt, sans retard ; l'élan revient au lâcher.
    hote.style.transition = 'none';
    bulle.classList.add('glisse');
    pos = { x: depart.px + dx, y: depart.py + dy };
    placer();
  });
  bulle.addEventListener('pointerup', () => {
    if (!depart) return;
    bulle.classList.remove('glisse');
    hote.style.transition = 'transform .45s cubic-bezier(.34, 1.56, .64, 1)';
    if (depart.bouge) {
      try {
        localStorage.setItem(CLE, JSON.stringify(pos));
      } catch {
        // Stockage refusé : la position ne sera pas retenue.
      }
    } else {
      etat.ouverte = !etat.ouverte;
      rafraichir();
      requestAnimationFrame(placer);
    }
    depart = null;
  });
  bAmbiance.addEventListener('click', () => file.push({ type: 'ambiance' }));
  bTelecharger.addEventListener('click', () => file.push({ type: 'telecharger' }));

  const poser = () => {
    if (!hote.isConnected) document.documentElement.appendChild(hote);
    rafraichir();
    placer();
  };
  addEventListener('resize', placer);
  document.addEventListener('fullscreenchange', rafraichir);
  // YouTube change de page sans recharger : boutons et thème se revérifient.
  setInterval(poser, 1000);
  poser();

  window.__escaleBulle = {
    prendre: () => file.splice(0),
    ambiance: (actif) => {
      etat.ambiance = Boolean(actif);
      rafraichir();
    }
  };
}

const CODE = `(${scriptAmbiance.toString()})();`;
const codeBulle = (libelles) => `(${scriptBulle.toString()})(${JSON.stringify(libelles)});`;

/** Pose (une fois par document) puis règle l'ambiance et la bulle d'une page YouTube. */
function appliquer(wc, actif, libelles) {
  if (wc.isDestroyed() || !surYouTube(wc.getURL())) return;
  const a = actif ? 'true' : 'false';
  const code = `${CODE}\nwindow.__escaleAmbiance(${a});\n${libelles ? codeBulle(libelles) : ''}\nwindow.__escaleBulle && window.__escaleBulle.ambiance(${a});`;
  wc.executeJavaScriptInIsolatedWorld(MONDE, [{ code }]).catch(() => {});
}

/**
 * À chaque page YouTube : ambiance et bulle suivent le réglage, et les
 * demandes de la bulle sont relevées tant que la page est sur YouTube.
 * `o` : { actif(), libelles(), basculer(), telecharger(wc) }.
 */
function brancher(wc, o) {
  wc.on('dom-ready', () => appliquer(wc, o.actif(), o.libelles()));
  const releve = setInterval(async () => {
    if (wc.isDestroyed()) return clearInterval(releve);
    if (!surYouTube(wc.getURL())) return;
    const demandes = await wc
      .executeJavaScriptInIsolatedWorld(MONDE, [{ code: 'window.__escaleBulle ? window.__escaleBulle.prendre() : []' }])
      .catch(() => []);
    for (const d of Array.isArray(demandes) ? demandes : []) {
      if (d?.type === 'ambiance') o.basculer();
      if (d?.type === 'telecharger') o.telecharger(wc);
    }
  }, 300);
}

module.exports = { brancher, appliquer, surYouTube };
