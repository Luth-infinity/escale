/**
 * Ce qu'une page a le droit d'ouvrir. Une page web ne déclenche jamais un
 * schéma d'application dangereux (ms-msdt:, search-ms:, file:…) ; les autres
 * schémas externes (mailto:, zoommtg:…) passent par une confirmation.
 */
const WEB = new Set(['http:', 'https:', 'about:', 'data:', 'blob:', 'chrome-extension:', 'devtools:']);
const BLOQUES = new Set([
  'file:', 'javascript:', 'vbscript:', 'ms-msdt:', 'search-ms:', 'search:', 'ms-officecmd:', 'ms-word:', 'ms-excel:',
  'ms-powerpoint:', 'ms-cxh:', 'ms-cxh-full:', 'ms-appinstaller:', 'smb:', 'afp:', 'nfs:', 'ftp:', 'jar:', 'shell:',
  'res:', 'its:', 'mk:', 'hcp:', 'help:', 'x-apple.systempreferences:', 'chrome:', 'view-source:'
]);

function politiqueSchema(url) {
  let protocole;
  try {
    protocole = new URL(url).protocol;
  } catch {
    return 'bloque';
  }
  if (WEB.has(protocole)) return 'web';
  if (protocole === 'escale:') return 'interne';
  if (BLOQUES.has(protocole)) return 'bloque';
  return 'externe';
}

// Réseau local et domaines de développement : HTTPS n'y existe souvent pas.
const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$|\.(local|localhost|test|internal|lan|home\.arpa)$/;

/** L'URL en https si une navigation http doit être relevée, sinon null. */
function versHttps(url, exceptions) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' || LOCAL.test(u.hostname) || exceptions.has(u.hostname)) return null;
  u.protocol = 'https:';
  return u.href;
}

module.exports = { politiqueSchema, versHttps };
