/**
 * Clés d'ordre fractionnaires : une chaîne en base 62 qui se compare en ordre
 * lexicographique. Insérer entre deux éléments ne réécrit que l'élément
 * déplacé, jamais ses voisins.
 *
 * Une clé ne finit jamais par « 0 » : il reste toujours de la place en dessous.
 * À force d'insérer au même endroit, une clé s'allonge d'environ un caractère
 * toutes les six insertions ; arbre.js redistribue alors le conteneur avec
 * repartir().
 */
const CHIFFRES = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = CHIFFRES.length;
const rang = (c) => CHIFFRES.indexOf(c);

// Milieu de deux fractions : a vaut « 0, a… », b vaut « 0, b… » ou 1 si null.
function milieu(a, b) {
  if (b !== null) {
    let n = 0;
    while ((a[n] || '0') === b[n]) n++;
    if (n > 0) return b.slice(0, n) + milieu(a.slice(n), b.slice(n));
  }
  const da = a ? rang(a[0]) : 0;
  const db = b !== null ? rang(b[0]) : BASE;
  if (db - da > 1) return CHIFFRES[Math.round((da + db) / 2)];
  if (b !== null && b.length > 1) return b[0];
  return CHIFFRES[da] + milieu(a.slice(1), null);
}

function entre(a, b) {
  if (a !== null && b !== null && a >= b) throw new Error(`ordre: ${a} >= ${b}`);
  return milieu(a || '', b);
}

/** n clés régulièrement espacées, de longueur minimale. */
function repartir(n) {
  let longueur = 1;
  while (BASE ** longueur - 1 < n) longueur++;
  const pas = (BASE ** longueur - 1) / (n + 1);
  const cles = [];
  for (let i = 1; i <= n; i++) {
    let v = Math.round(i * pas);
    let s = '';
    for (let j = 0; j < longueur; j++) {
      s = CHIFFRES[v % BASE] + s;
      v = Math.floor(v / BASE);
    }
    cles.push(s.replace(/0+$/, '') || CHIFFRES[1]);
  }
  return cles;
}

module.exports = { entre, repartir };
