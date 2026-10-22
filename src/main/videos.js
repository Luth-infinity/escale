const { app, net, Menu } = require('electron');
const { spawn, execFile } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { t } = require('./i18n');

/**
 * Téléchargement des vidéos YouTube par yt-dlp, repris de Hublink (voir son
 * CLAUDE.md pour les mesures). Ni yt-dlp, ni ffmpeg, ni le moteur JavaScript
 * ne sont embarqués : ils arrivent au premier usage dans userData/outils.
 *
 * Écart avec Hublink : yt-dlp exige un moteur JavaScript pour lire YouTube.
 * Hublink lui prête Electron (ELECTRON_RUN_AS_NODE) ; Escale garde le fusible
 * RunAsNode fermé (spec §9.3) et lui donne Deno, que yt-dlp sait utiliser.
 */
const DOSSIER_OUTILS = () => path.join(app.getPath('userData'), 'outils');
const WIN = process.platform === 'win32';
const EXE = WIN ? '.exe' : '';
const ARM = process.arch === 'arm64';

// La dernière version de yt-dlp, toujours : une version de quelques semaines
// suffit à ne plus rien lire sur YouTube.
function sourceYtDlp() {
  const base = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
  if (WIN) return base + (ARM ? 'yt-dlp_arm64.exe' : 'yt-dlp.exe');
  if (process.platform === 'darwin') return base + 'yt-dlp_macos';
  return base + 'yt-dlp';
}

// ffmpeg figé : il ne fait qu'assembler et convertir. Les binaires de
// ffmpeg-static sont six fois plus légers que les archives complètes.
function sourceFfmpeg() {
  const base = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/';
  if (WIN) return base + 'ffmpeg-win32-x64.gz';
  if (process.platform === 'darwin') return base + `ffmpeg-darwin-${ARM ? 'arm64' : 'x64'}.gz`;
  return base + `ffmpeg-linux-${ARM ? 'arm64' : 'x64'}.gz`;
}

function sourceDeno() {
  const base = 'https://github.com/denoland/deno/releases/latest/download/';
  const cible = WIN
    ? `${ARM ? 'aarch64' : 'x86_64'}-pc-windows-msvc`
    : process.platform === 'darwin'
      ? `${ARM ? 'aarch64' : 'x86_64'}-apple-darwin`
      : `${ARM ? 'aarch64' : 'x86_64'}-unknown-linux-gnu`;
  return `${base}deno-${cible}.zip`;
}

const cheminYtDlp = () => path.join(DOSSIER_OUTILS(), 'yt-dlp' + EXE);
const cheminFfmpeg = () => path.join(DOSSIER_OUTILS(), 'ffmpeg' + EXE);
const cheminDeno = () => path.join(DOSSIER_OUTILS(), 'deno' + EXE);

/**
 * Les formats proposés. Le MP4 préfère le H.264 + AAC, que lisent le lecteur
 * de Windows, PowerPoint et les logiciels de montage ; « Qualité maximale »
 * lève cette préférence, le H.264 de YouTube s'arrêtant au 1080p.
 */
const FORMATS = {
  'mp4-1080': ['-S', 'res:1080,vcodec:h264,acodec:m4a', '--merge-output-format', 'mp4'],
  'mp4-720': ['-S', 'res:720,vcodec:h264,acodec:m4a', '--merge-output-format', 'mp4'],
  'mp4-max': ['-S', 'res,acodec:m4a', '--merge-output-format', 'mp4'],
  mp3: ['-x', '--audio-format', 'mp3', '--audio-quality', '0'],
  m4a: ['-f', 'ba[ext=m4a]/ba', '-x', '--audio-format', 'm4a'],
  wav: ['-x', '--audio-format', 'wav'],
  // Rien n'est téléchargé : le chemin de l'image ne se lit qu'en fin de vidéo.
  miniature: ['--skip-download', '--write-thumbnail', '--convert-thumbnails', 'jpg', '--print', 'after_video:ESCALE-FICHIER %(thumbnails.-1.filepath)s']
};

const LIBELLES = [
  ['mp4-1080', 'Vidéo MP4 · 1080p'],
  ['mp4-720', 'Vidéo MP4 · 720p'],
  ['mp4-max', 'Vidéo · qualité maximale'],
  null,
  ['mp3', 'Audio MP3'],
  ['m4a', 'Audio M4A'],
  ['wav', 'Audio WAV'],
  null,
  ['miniature', 'Miniature (JPG)']
];

/** Une page de vidéo YouTube, et rien d'autre. */
function estVideoYouTube(url) {
  try {
    const u = new URL(url);
    if (!/^(www\.|m\.|music\.)?youtube\.com$/.test(u.hostname)) return false;
    return (u.pathname === '/watch' && u.searchParams.has('v')) || u.pathname.startsWith('/shorts/');
  } catch {
    return false;
  }
}

/** Le seul fichier d'une archive zip (celle de Deno), sans dépendance. */
function extraireZipUnique(zip) {
  const fin = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fin < 0) throw new Error('archive zip illisible');
  const central = zip.readUInt32LE(fin + 16);
  if (zip.readUInt32LE(central) !== 0x02014b50) throw new Error('archive zip illisible');
  const methode = zip.readUInt16LE(central + 10);
  const taille = zip.readUInt32LE(central + 20);
  const local = zip.readUInt32LE(central + 42);
  const debut = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const donnees = zip.subarray(debut, debut + taille);
  if (methode === 0) return donnees;
  if (methode === 8) return zlib.inflateRawSync(donnees);
  throw new Error(`compression zip ${methode} non prise en charge`);
}

async function telechargerOutil(url, cible, deballer) {
  const rep = await net.fetch(url);
  if (!rep.ok) throw new Error(`${rep.status} sur ${url}`);
  const donnees = deballer(Buffer.from(await rep.arrayBuffer()));
  // Écrit à côté puis renomme : un téléchargement coupé ne laisse pas un
  // exécutable tronqué qu'on prendrait ensuite pour le bon.
  const temp = cible + '.part';
  fs.writeFileSync(temp, donnees);
  fs.chmodSync(temp, 0o755);
  fs.renameSync(temp, cible);
}

let preparation = null;
let misAJour = false;

/** yt-dlp, ffmpeg et Deno prêts ; yt-dlp se met à jour une fois par lancement. */
function preparer() {
  if (preparation) return preparation;
  preparation = (async () => {
    fs.mkdirSync(DOSSIER_OUTILS(), { recursive: true });
    const manquants = [];
    if (!fs.existsSync(cheminYtDlp())) manquants.push(telechargerOutil(sourceYtDlp(), cheminYtDlp(), (b) => b));
    if (!fs.existsSync(cheminFfmpeg())) manquants.push(telechargerOutil(sourceFfmpeg(), cheminFfmpeg(), (b) => zlib.gunzipSync(b)));
    if (!fs.existsSync(cheminDeno())) manquants.push(telechargerOutil(sourceDeno(), cheminDeno(), extraireZipUnique));
    const premiereFois = manquants.length > 0;
    await Promise.all(manquants);
    if (!premiereFois && !misAJour) {
      misAJour = true;
      // Une mise à jour ratée n'empêche rien : la version en place sert encore.
      await new Promise((r) => execFile(cheminYtDlp(), ['-U'], { timeout: 30000, windowsHide: true }, () => r()));
    }
  })();
  // Un échec ne reste pas en cache : le prochain essai recommence.
  preparation.catch(() => {
    preparation = null;
  });
  return preparation;
}

/**
 * Les cookies YouTube et Google de la page, au format que lit yt-dlp. Sans
 * eux, YouTube répond vite « Sign in to confirm you're not a bot ». Le fichier
 * porte une session : lisible du seul utilisateur, effacé à la fin.
 */
async function fichierCookies(ses, id) {
  const domaine = /(^|\.)(youtube\.com|google\.com)$/;
  const cookies = (await ses.cookies.get({})).filter((c) => domaine.test(c.domain.replace(/^\./, '')));
  if (cookies.length === 0) return null;
  const lignes = cookies.map((c) => {
    const dom = c.hostOnly ? c.domain.replace(/^\./, '') : c.domain.startsWith('.') ? c.domain : `.${c.domain}`;
    return [dom, dom.startsWith('.') ? 'TRUE' : 'FALSE', c.path || '/', c.secure ? 'TRUE' : 'FALSE',
      c.session || !c.expirationDate ? 0 : Math.floor(c.expirationDate), c.name, c.value].join('\t');
  });
  const chemin = path.join(os.tmpdir(), `escale-cookies-${id}.txt`);
  fs.writeFileSync(chemin, ['# Netscape HTTP Cookie File', ...lignes, ''].join('\n'), { mode: 0o600 });
  return chemin;
}

const enCours = new Map(); // id → processus
const finis = new Map(); // id → chemin du fichier

/**
 * Télécharge la vidéo dans le dossier Téléchargements. `signaler(etat)` reçoit
 * { id, nom, recu, total, etat: 'prepare'|'en-cours'|'fini'|'echec'|'annule', erreur?, detail? }.
 */
async function telecharger({ url, format, titre, session }, signaler) {
  if (!estVideoYouTube(url) || !FORMATS[format]) return;
  const id = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let nom = titre || t('Vidéo YouTube');
  const premiere = !fs.existsSync(cheminYtDlp()) || !fs.existsSync(cheminFfmpeg()) || !fs.existsSync(cheminDeno());
  signaler({ id, nom, recu: 0, total: 0, etat: 'prepare', detail: premiere ? t('Première fois : installation des outils…') : '' });
  try {
    await preparer();
  } catch (e) {
    console.warn('[videos] préparation impossible :', e);
    signaler({ id, nom, etat: 'echec', erreur: t('Outils introuvables, vérifiez la connexion') });
    return;
  }

  const dossier = app.getPath('downloads');
  let cookies = null;
  try {
    cookies = await fichierCookies(session, id);
  } catch (e) {
    console.warn('[videos] cookies illisibles :', e);
  }
  const args = [
    ...(cookies ? ['--cookies', cookies] : []),
    ...FORMATS[format],
    '--js-runtimes', `deno:${cheminDeno()}`,
    '--ffmpeg-location', DOSSIER_OUTILS(),
    '--encoding', 'utf-8',
    // Une vidéo ouverte depuis une playlist porte `&list=` : on veut la vidéo.
    '--no-playlist',
    // Sinon le fichier prend la date de mise en ligne et se range des années en arrière.
    '--no-mtime',
    '--windows-filenames',
    '--newline',
    // --print implique --quiet : --progress est indispensable.
    '--progress',
    '--progress-template', 'download:ESCALE-PROGRES %(progress.downloaded_bytes)s %(progress.total_bytes,progress.total_bytes_estimate)s %(progress.tmpfilename)s',
    ...(format === 'miniature'
      ? []
      : ['--print', 'before_dl:ESCALE-INFO %(filesize,filesize_approx)s %(title)s', '--print', 'after_move:ESCALE-FICHIER %(filepath)s']),
    '-P', dossier,
    '-o', '%(title)s.%(ext)s',
    url
  ];
  const proc = spawn(cheminYtDlp(), args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  enCours.set(id, proc);

  // Un MP4 arrive en deux flux, l'image puis le son : on additionne, sinon la
  // barre repartirait de zéro au milieu.
  let total = 0;
  let base = 0;
  let precedent = 0;
  let fichier = '';
  let dernierEnvoi = 0;
  const erreurs = [];
  const temporaires = new Set();

  const lire = (ligne) => {
    if (ligne.startsWith('ESCALE-INFO ')) {
      const [, taille, ...reste] = ligne.split(' ');
      total = Number(taille) || 0;
      if (reste.join(' ')) nom = reste.join(' ');
      signaler({ id, nom, recu: base + precedent, total, etat: 'en-cours' });
    } else if (ligne.startsWith('ESCALE-PROGRES ')) {
      const [, recu, attendu, ...temp] = ligne.split(' ');
      if (temp.join(' ') && temp.join(' ') !== 'NA') temporaires.add(temp.join(' '));
      const n = Number(recu) || 0;
      if (n < precedent) base += precedent;
      precedent = n;
      if (!total) total = Number(attendu) || 0;
      const maintenant = Date.now();
      if (maintenant - dernierEnvoi < 250) return;
      dernierEnvoi = maintenant;
      signaler({ id, nom, recu: Math.min(base + n, total || Infinity), total, etat: 'en-cours' });
    } else if (ligne.startsWith('ESCALE-FICHIER ')) {
      fichier = ligne.slice('ESCALE-FICHIER '.length).trim();
    } else if (ligne.startsWith('ERROR:')) {
      erreurs.push(ligne.slice(6).trim());
    }
  };
  const brancher = (flux) => {
    let reste = '';
    flux.setEncoding('utf8');
    flux.on('data', (morceau) => {
      const lignes = (reste + morceau).split(/\r?\n/);
      reste = lignes.pop();
      lignes.forEach(lire);
    });
    flux.on('end', () => reste && lire(reste));
  };
  brancher(proc.stdout);
  brancher(proc.stderr);

  proc.on('error', (e) => erreurs.push(e.message));
  proc.on('close', (code) => {
    if (cookies) fs.rmSync(cookies, { force: true });
    const annule = proc.escaleAnnule;
    enCours.delete(id);
    if (code === 0 && !annule) {
      finis.set(id, fichier);
      signaler({ id, nom: fichier ? path.basename(fichier) : nom, recu: total, total, etat: 'fini' });
    } else {
      nettoyer(temporaires);
      if (!annule) console.warn('[videos] yt-dlp a échoué :', erreurs.join(' | ') || `code ${code}`);
      signaler({ id, nom, etat: annule ? 'annule' : 'echec', erreur: annule ? '' : resumerErreur(erreurs) });
    }
  });
}

/** Efface les restes d'un téléchargement inachevé : .part, .ytdl, flux intermédiaires. */
function nettoyer(temporaires) {
  for (const temp of temporaires) {
    const complet = temp.replace(/\.part$/, '');
    const candidats = [temp, `${temp}.ytdl`, `${complet}.ytdl`];
    if (/\.f[\w-]+\.\w+$/.test(complet)) candidats.push(complet);
    for (const f of candidats) {
      try {
        fs.rmSync(f, { force: true });
      } catch {
        // Encore verrouillé, ou déjà parti.
      }
    }
  }
}

// Des phrases entières : « age » seul attrapait « page » et « message ».
function resumerErreur(erreurs) {
  const texte = erreurs.join(' ');
  if (/not a bot/i.test(texte)) return t('YouTube bloque le téléchargement : connectez-vous à YouTube, puis réessayez');
  if (/confirm your age|age-restricted|inappropriate for some users/i.test(texte)) return t('Vidéo soumise à une limite d’âge : connectez-vous à YouTube');
  if (/members-only|join this channel/i.test(texte)) return t('Vidéo réservée aux membres de la chaîne');
  if (/Private video|Video unavailable|This video is unavailable/i.test(texte)) return t('Vidéo indisponible');
  if (/getaddrinfo|Unable to download|timed out/i.test(texte)) return t('Connexion impossible');
  return erreurs[0] ? erreurs[0].slice(0, 120) : t('Le téléchargement a échoué');
}

function annuler(id) {
  const proc = enCours.get(id);
  if (!proc) return;
  proc.escaleAnnule = true;
  // Sous Windows, tuer yt-dlp laisse ffmpeg orphelin : on emporte l'arbre.
  if (WIN) execFile('taskkill', ['/pid', String(proc.pid), '/t', '/f'], { windowsHide: true }, () => {});
  else proc.kill();
}

const cheminFini = (id) => finis.get(id) || null;

/** Le menu des formats, sous le pointeur ; la progression part à `signaler`. */
function ouvrirMenu(wc, fenetre, signaler) {
  if (!wc || wc.isDestroyed() || !estVideoYouTube(wc.getURL())) return;
  const url = wc.getURL();
  const lancer = (format) =>
    telecharger({ url, format, titre: wc.getTitle().replace(/ - YouTube$/, ''), session: wc.session }, signaler);
  Menu.buildFromTemplate(
    LIBELLES.map((l) => (l ? { label: t(l[1]), click: () => lancer(l[0]) } : { type: 'separator' }))
  ).popup({ window: fenetre });
}

module.exports = { telecharger, annuler, estVideoYouTube, cheminFini, ouvrirMenu, extraireZipUnique };
