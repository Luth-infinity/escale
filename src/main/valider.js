/**
 * Validation des messages venus du shell. Un schéma minimal, écrit à la main :
 * le shell est notre propre code, mais tout ce qui traverse l'IPC est traité
 * comme une entrée externe. Une clé inconnue est refusée, pas ignorée.
 *
 * { type: 'string'|'number'|'boolean'|'objet'|'tableau'|'enum',
 *   max?, valeurs?, champs?, elements?, optionnel?, nul? }
 */
function echec(chemin) {
  throw new Error(`payload-invalide: ${chemin || '(racine)'}`);
}

function verifier(s, v, chemin) {
  if (v === null && s.nul) return;
  switch (s.type) {
    case 'string':
      if (typeof v !== 'string' || (s.max !== undefined && v.length > s.max)) echec(chemin);
      return;
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) echec(chemin);
      return;
    case 'boolean':
      if (typeof v !== 'boolean') echec(chemin);
      return;
    case 'enum':
      if (!s.valeurs.includes(v)) echec(chemin);
      return;
    case 'tableau':
      if (!Array.isArray(v) || (s.max !== undefined && v.length > s.max)) echec(chemin);
      v.forEach((x, i) => verifier(s.elements, x, chemin ? `${chemin}.${i}` : String(i)));
      return;
    case 'objet': {
      if (!v || typeof v !== 'object' || Array.isArray(v)) echec(chemin);
      const sous = (k) => (chemin ? `${chemin}.${k}` : k);
      for (const k of Object.keys(v)) if (!Object.hasOwn(s.champs, k)) echec(sous(k));
      for (const [k, c] of Object.entries(s.champs)) {
        if (v[k] === undefined) {
          if (!c.optionnel) echec(sous(k));
        } else verifier(c, v[k], sous(k));
      }
      return;
    }
    default:
      throw new Error(`schema-inconnu: ${s.type}`);
  }
}

function valider(schema, valeur) {
  verifier(schema, valeur, '');
  return valeur;
}

module.exports = { valider };
