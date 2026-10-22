/**
 * Les décisions d'onglets qui ne touchent pas Electron, pour être testées
 * sous Node.
 */

/** Les onglets vivants à endormir : inactifs depuis plus de `delaiMs`. */
function aEndormir(onglets, vivants, actifId, maintenant, delaiMs, joueDuSon) {
  if (!delaiMs) return [];
  const limite = maintenant - delaiMs;
  return onglets
    .filter((o) => vivants.has(o.id) && o.id !== actifId && !joueDuSon.has(o.id) && o.derniereActivite < limite)
    .map((o) => o.id);
}

/**
 * Regroupe les changements de titre, favicon et URL d'un onglet sur une
 * fenêtre de `fenetreMs` : une page qui réécrit son titre à chaque frappe ne
 * doit pas déclencher un delta (et une écriture disque) par lettre.
 */
function regrouperMeta(fenetreMs, emettre) {
  const attente = new Map(); // id → { patch, minuteur }
  function vider(id) {
    const a = attente.get(id);
    if (!a) return;
    clearTimeout(a.minuteur);
    attente.delete(id);
    emettre(id, a.patch);
  }
  function pousser(id, patch) {
    const a = attente.get(id);
    if (a) Object.assign(a.patch, patch);
    else attente.set(id, { patch: { ...patch }, minuteur: setTimeout(() => vider(id), fenetreMs) });
  }
  pousser.vider = vider;
  pousser.oublier = (id) => {
    clearTimeout(attente.get(id)?.minuteur);
    attente.delete(id);
  };
  return pousser;
}

module.exports = { aEndormir, regrouperMeta };
