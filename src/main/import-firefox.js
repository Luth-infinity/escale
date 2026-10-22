const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { profilParDefaut, versElectron } = require('./import-firefox-purs');
const dialogue = require('./dialogue');
const { t } = require('./i18n');

/**
 * Importer les sessions de Firefox : ses cookies, lus dans cookies.sqlite du
 * profil par défaut. Firefox ne les chiffre pas (contrairement à Chrome et
 * Edge) ; c'est ce qui rend l'import possible, et ce qui permet de rester
 * connecté à un service (Google) qui refuse les connexions depuis Escale.
 *
 * Seuls les cookies hors conteneurs et hors partition sont repris : ceux d'un
 * conteneur Firefox appartiennent à une autre identité.
 */
function dossierFirefox() {
  if (process.platform === 'win32') return path.join(process.env.APPDATA || '', 'Mozilla', 'Firefox');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Firefox');
  return path.join(os.homedir(), '.mozilla', 'firefox');
}

const lire = (f) => {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch {
    return '';
  }
};

/** Le dossier du profil Firefox par défaut, ou null s'il n'y en a pas. */
function trouverProfil() {
  const racine = dossierFirefox();
  const relatif = profilParDefaut(lire(path.join(racine, 'installs.ini')), lire(path.join(racine, 'profiles.ini')));
  if (!relatif) return null;
  const dossier = path.isAbsolute(relatif) ? relatif : path.join(racine, relatif);
  return fs.existsSync(path.join(dossier, 'cookies.sqlite')) ? dossier : null;
}

/**
 * Les cookies du profil, traduits pour Electron. Firefox ouvert verrouille sa
 * base : on lit une copie (avec son journal -wal), effacée aussitôt après.
 */
function lireCookies(profil) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'escale-firefox-'));
  try {
    for (const f of ['cookies.sqlite', 'cookies.sqlite-wal']) {
      const source = path.join(profil, f);
      if (fs.existsSync(source)) fs.copyFileSync(source, path.join(tmp, f));
    }
    const db = new DatabaseSync(path.join(tmp, 'cookies.sqlite'));
    try {
      const lignes = db
        .prepare(`SELECT name, value, host, path, expiry, isSecure, isHttpOnly, sameSite FROM moz_cookies WHERE originAttributes = ''`)
        .all();
      return lignes.map((c) => versElectron(c)).filter(Boolean);
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Pose les cookies dans la session ; renvoie { importes, ignores }. */
async function importer(ses, cookies) {
  let importes = 0;
  for (const c of cookies) {
    try {
      await ses.cookies.set(c);
      importes++;
    } catch {
      // Un cookie que Chromium refuse (préfixe, attribut) n'arrête pas l'import.
    }
  }
  await ses.cookies.flushStore();
  return { importes, ignores: cookies.length - importes };
}

const estRefusGoogle = (url) => {
  try {
    const u = new URL(url);
    return u.hostname === 'accounts.google.com' && /\/signin\/rejected/.test(u.pathname);
  } catch {
    return false;
  }
};

/**
 * Sur l'écran « Impossible de vous connecter » de Google, propose l'import
 * Firefox, puis ramène l'onglet à la page d'où partait la connexion : la
 * session importée y est déjà valable.
 */
function surveillerRefusGoogle(wc) {
  let enCours = false;
  wc.on('did-navigate', async (_e, url) => {
    if (enCours || !estRefusGoogle(url)) return;
    const profil = trouverProfil();
    enCours = true;
    try {
      const oui = await dialogue.demander({
        titre: t('Google refuse la connexion depuis Escale'),
        detail: profil
          ? t('Google bloque les connexions depuis les navigateurs intégrés comme Escale. Escale peut reprendre votre session Google depuis Firefox : connectez-vous d’abord à Google dans Firefox si ce n’est pas fait.')
          : t('Google bloque les connexions depuis les navigateurs intégrés comme Escale, et aucun profil Firefox n’a été trouvé pour reprendre votre session.'),
        annuler: t('Plus tard'),
        confirmer: profil ? t('Importer depuis Firefox') : t('Compris')
      });
      if (!oui || !profil || wc.isDestroyed()) return;
      await importer(wc.session, lireCookies(profil));
      if (wc.isDestroyed()) return;
      // La dernière page avant la connexion Google ; à défaut, Google.
      const entrees = wc.navigationHistory.getAllEntries();
      const avant = entrees
        .slice(0, wc.navigationHistory.getActiveIndex())
        .reverse()
        .find((e) => /^https?:/.test(e.url) && new URL(e.url).hostname !== 'accounts.google.com');
      wc.loadURL(avant ? avant.url : 'https://www.google.com/');
    } finally {
      enCours = false;
    }
  });
}

module.exports = { trouverProfil, lireCookies, importer, surveillerRefusGoogle };
