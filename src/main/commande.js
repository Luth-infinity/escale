/**
 * La barre de commande (Cmd+T / Cmd+L) : ce qu'on tape devient une liste de
 * destinations — onglets ouverts, épinglés, historique, adresse ou recherche.
 * Pur, pour être testé sous Node.
 */
const MAX = 8;

const MOTEURS = {
  google: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  duckduckgo: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  bing: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  qwant: (q) => `https://www.qwant.com/?q=${encodeURIComponent(q)}`,
  ecosia: (q) => `https://www.ecosia.org/search?q=${encodeURIComponent(q)}`
};

const RACCOURCIS = {
  yt: { nom: 'YouTube', url: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
  gh: { nom: 'GitHub', url: (q) => `https://github.com/search?q=${encodeURIComponent(q)}` },
  w: { nom: 'Wikipédia', url: (q) => `https://fr.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}` },
  g: { nom: 'Google', url: MOTEURS.google }
};

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/\S*)?$/;
const LOCAL = /^localhost(:\d+)?(\/\S*)?$/i;
const DOMAINE = /^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?([/?#]\S*)?$/i;

/** L'URL si le texte ressemble à une adresse web, sinon null. */
function versUrl(texte) {
  const t = String(texte).trim();
  if (!t || /\s/.test(t)) return null;
  let candidat = null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) candidat = t;
  else if (LOCAL.test(t) || IPV4.test(t)) candidat = `http://${t}`;
  else if (DOMAINE.test(t)) candidat = `https://${t}`;
  if (!candidat) return null;
  try {
    const u = new URL(candidat);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

const plat = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const mots = (s) => plat(s).match(/[\p{L}\p{N}]+/gu) || [];

function hote(url) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function resoudre(texte, etat, historique, moteur = 'google') {
  const brut = String(texte).trim();
  if (!brut) return [];

  // « yt chat » : recherche directe sur le site du raccourci.
  const m = /^(\S+)\s+(.+)$/.exec(brut);
  if (m && RACCOURCIS[m[1].toLowerCase()]) {
    const r = RACCOURCIS[m[1].toLowerCase()];
    return [{ type: 'recherche', titre: `Rechercher « ${m[2]} » sur ${r.nom}`, url: r.url(m[2]), requete: m[2], site: r.nom }];
  }

  const resultats = [];
  const url = versUrl(brut);
  if (url) resultats.push({ type: 'url', titre: hote(url), url });

  const requete = mots(brut);
  const correspond = (o) => {
    const meule = plat(`${o.titre} ${o.url}`);
    return requete.length > 0 && requete.every((w) => meule.includes(w));
  };
  const ici = (o) => o.espaceId === etat.espaceActif;
  const trouves = etat.onglets.filter(correspond);
  const ordonnes = [
    ...trouves.filter((o) => ici(o) && !o.epingle),
    ...trouves.filter((o) => ici(o) && o.epingle),
    ...trouves.filter((o) => !ici(o))
  ];
  for (const o of ordonnes) resultats.push({ type: o.epingle ? 'epingle' : 'onglet', titre: o.titre || hote(o.url), url: o.url, id: o.id });

  const dejaLa = new Set(resultats.map((r) => r.url));
  for (const h of historique.chercher(brut, MAX)) {
    if (dejaLa.has(h.url)) continue;
    dejaLa.add(h.url);
    resultats.push({ type: 'historique', titre: h.titre || hote(h.url), url: h.url });
  }

  // La recherche reste toujours proposée, en dernier.
  const recherche = { type: 'recherche', titre: `Rechercher « ${brut} »`, url: (MOTEURS[moteur] || MOTEURS.google)(brut), requete: brut };
  return [...resultats.slice(0, MAX - 1), recherche];
}

module.exports = { resoudre, versUrl, MOTEURS };
