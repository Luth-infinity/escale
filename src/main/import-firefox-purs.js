/**
 * La part pure de l'import Firefox (testée sous Node) : trouver le profil par
 * défaut dans installs.ini / profiles.ini, et traduire une ligne de
 * moz_cookies en détails pour session.cookies.set().
 */

/** Le chemin relatif du profil par défaut, ou null. */
function profilParDefaut(installsIni, profilesIni) {
  // installs.ini porte le profil réellement utilisé par l'installation.
  const installe = /^Default=(.+)$/m.exec(installsIni || '');
  if (installe) return installe[1].trim();
  // Sinon : la section de profiles.ini marquée Default=1.
  for (const section of (profilesIni || '').split(/^\[/m)) {
    if (/^Default=1\s*$/m.test(section)) {
      const chemin = /^Path=(.+)$/m.exec(section);
      if (chemin) return chemin[1].trim();
    }
  }
  return null;
}

// moz_cookies.sameSite : 0 None, 1 Lax, 2 Strict, 256 non précisé.
const SAME_SITE = { 0: 'no_restriction', 1: 'lax', 2: 'strict' };

/** Une ligne de moz_cookies → détails de cookies.set(), ou null si inutilisable. */
function versElectron(c, maintenant = Date.now()) {
  if (!c.host || !c.name) return null;
  // Firefox note l'expiration en millisecondes (en secondes jadis).
  const expiration = c.expiry > 1e11 ? c.expiry / 1000 : c.expiry;
  if (!expiration || expiration * 1000 <= maintenant) return null;
  const secure = Boolean(c.isSecure);
  const hote = c.host.replace(/^\./, '');
  let sameSite = SAME_SITE[c.sameSite] || 'unspecified';
  // SameSite=None exige Secure : sinon Chromium refuse le cookie.
  if (sameSite === 'no_restriction' && !secure) sameSite = 'unspecified';
  const details = {
    url: `${secure ? 'https' : 'http'}://${hote}${c.path || '/'}`,
    name: c.name,
    value: c.value ?? '',
    path: c.path || '/',
    secure,
    httpOnly: Boolean(c.isHttpOnly),
    expirationDate: Math.floor(expiration),
    sameSite
  };
  // Un hôte en « .exemple.fr » vaut pour les sous-domaines ; sans point, le
  // cookie reste attaché à l'hôte seul (et __Host- l'exige).
  if (c.host.startsWith('.')) details.domain = c.host;
  return details;
}

module.exports = { profilParDefaut, versElectron };
