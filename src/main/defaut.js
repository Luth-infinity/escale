const { app, shell } = require('electron');
const { execFile } = require('node:child_process');

/**
 * Escale comme navigateur par défaut, et les liens qu'on lui confie.
 *
 * Windows ne laisse plus une application se désigner elle-même : on s'inscrit
 * comme navigateur dans le registre de l'utilisateur (HKCU, sans droits
 * d'administrateur), puis on ouvre la page des applications par défaut,
 * réglée sur Escale, où l'on choisit. macOS pose lui-même la question.
 */
const WIN = process.platform === 'win32';
const CLE_CLIENT = 'HKCU\\Software\\Clients\\StartMenuInternet\\Escale';
const PROGID = 'EscaleURL';

const reg = (args) =>
  new Promise((ok, ko) => execFile('reg', args, { windowsHide: true }, (e, sortie) => (e ? ko(e) : ok(sortie))));
const ecrire = (cle, nom, valeur) => reg(['add', cle, ...(nom === null ? ['/ve'] : ['/v', nom]), '/t', 'REG_SZ', '/d', valeur, '/f']);

async function inscrireWindows() {
  const exe = process.execPath;
  const ouvrir = `"${exe}" "%1"`;
  await ecrire(`HKCU\\Software\\Classes\\${PROGID}`, null, 'Escale URL');
  await ecrire(`HKCU\\Software\\Classes\\${PROGID}`, 'URL Protocol', '');
  await ecrire(`HKCU\\Software\\Classes\\${PROGID}\\DefaultIcon`, null, `${exe},0`);
  await ecrire(`HKCU\\Software\\Classes\\${PROGID}\\shell\\open\\command`, null, ouvrir);
  await ecrire(CLE_CLIENT, null, 'Escale');
  await ecrire(`${CLE_CLIENT}\\DefaultIcon`, null, `${exe},0`);
  await ecrire(`${CLE_CLIENT}\\shell\\open\\command`, null, `"${exe}"`);
  await ecrire(`${CLE_CLIENT}\\Capabilities`, 'ApplicationName', 'Escale');
  await ecrire(`${CLE_CLIENT}\\Capabilities`, 'ApplicationDescription', 'Navigateur à onglets verticaux');
  await ecrire(`${CLE_CLIENT}\\Capabilities`, 'ApplicationIcon', `${exe},0`);
  for (const p of ['http', 'https']) await ecrire(`${CLE_CLIENT}\\Capabilities\\URLAssociations`, p, PROGID);
  for (const e of ['.htm', '.html', '.pdf']) await ecrire(`${CLE_CLIENT}\\Capabilities\\FileAssociations`, e, PROGID);
  await ecrire('HKCU\\Software\\RegisteredApplications', 'Escale', 'Software\\Clients\\StartMenuInternet\\Escale\\Capabilities');
}

/** { ok, raison? } — l'app de développement ne s'inscrit pas : son chemin change. */
async function definir() {
  if (!app.isPackaged) return { ok: false, raison: 'dev' };
  if (WIN) {
    await inscrireWindows();
    await shell.openExternal('ms-settings:defaultapps?registeredAppUser=Escale');
    return { ok: true };
  }
  const ok = app.setAsDefaultProtocolClient('http') && app.setAsDefaultProtocolClient('https');
  return { ok };
}

async function estParDefaut() {
  if (!WIN) return app.isDefaultProtocolClient('https');
  try {
    const sortie = await reg(['query', 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice', '/v', 'ProgId']);
    return sortie.includes(PROGID);
  } catch {
    return false;
  }
}

/** Les adresses web d'une ligne de commande (lien cliqué ailleurs). */
const liensDe = (argv) => argv.filter((a) => /^https?:\/\//i.test(a));

module.exports = { definir, estParDefaut, liensDe };
