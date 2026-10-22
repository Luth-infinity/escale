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

module.exports = { estShell };
