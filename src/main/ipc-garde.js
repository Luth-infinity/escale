/**
 * Le shell est la seule page autorisée à parler au process principal. Une
 * page web, une extension ou une sous-frame qui tenterait un appel IPC est
 * refusée ici, avant même la validation du message.
 *
 * Pur (pas d'electron) pour être testé sous Node.
 */
function sansAncre(url) {
  const u = new URL(url);
  u.hash = '';
  return u.href;
}

function estShell(frame, urlShell) {
  if (!frame || frame.parent) return false;
  try {
    return sansAncre(frame.url) === sansAncre(urlShell);
  } catch {
    return false;
  }
}

/**
 * L'adresse d'où charger le shell. Le serveur de dev n'est JAMAIS utilisé par
 * l'app empaquetée, quels que soient ses arguments : `--dev` ferait confiance
 * à quiconque écoute sur ce port local.
 */
function urlShell({ empaquetee, argv, dev, dist }) {
  return !empaquetee && !argv.includes('--shell-dist') ? dev : dist;
}

module.exports = { estShell, urlShell };
