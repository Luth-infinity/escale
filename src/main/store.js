const fs = require('node:fs');
const path = require('node:path');
const { creerEtat } = require('./model/arbre');

/**
 * L'état d'Escale sur disque : escale.json, écrit d'un bloc (fichier
 * temporaire puis rename) pour qu'un crash ne laisse jamais un fichier à
 * moitié écrit. La version précédente est gardée en escale.json.prec : c'est
 * elle qu'on relit si le fichier principal est illisible.
 */
const FICHIER = 'escale.json';
const DELAI_MS = 1000;
const enAttente = new Map();

function valide(etat) {
  return (
    etat && etat.version === 1 &&
    Array.isArray(etat.espaces) && etat.espaces.length > 0 &&
    Array.isArray(etat.dossiers) && Array.isArray(etat.onglets) &&
    etat.espaces.some((e) => e.id === etat.espaceActif)
  );
}

function lire(chemin) {
  try {
    const etat = JSON.parse(fs.readFileSync(chemin, 'utf8'));
    return valide(etat) ? etat : undefined;
  } catch (e) {
    return e.code === 'ENOENT' ? null : undefined;
  }
}

/** null = absent, undefined = illisible. */
function charger(dir) {
  const principal = path.join(dir, FICHIER);
  const etat = lire(principal);
  if (etat) return etat;
  if (etat === undefined) fs.renameSync(principal, `${principal}.corrompu-${Date.now()}`);
  return lire(`${principal}.prec`) || creerEtat();
}

function ecrireMaintenant(dir, etat) {
  const t = enAttente.get(dir);
  if (t) clearTimeout(t.minuteur);
  enAttente.delete(dir);
  const principal = path.join(dir, FICHIER);
  const tmp = `${principal}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(etat), { mode: 0o600 });
  if (fs.existsSync(principal)) fs.copyFileSync(principal, `${principal}.prec`);
  fs.renameSync(tmp, principal);
}

function planifierEcriture(dir, etat) {
  const t = enAttente.get(dir);
  if (t) clearTimeout(t.minuteur);
  enAttente.set(dir, { etat, minuteur: setTimeout(() => ecrireMaintenant(dir, etat), DELAI_MS) });
}

/** À la fermeture : écrit ce qui attend encore. */
function vider() {
  for (const [dir, t] of [...enAttente]) ecrireMaintenant(dir, t.etat);
}

module.exports = { charger, planifierEcriture, ecrireMaintenant, vider };
