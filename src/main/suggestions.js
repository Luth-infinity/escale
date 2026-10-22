const { net } = require('electron');
const { versUrl } = require('./commande');

/**
 * Les suggestions du moteur pour la barre de commande. Ce qui ressemble à une
 * adresse n'est jamais envoyé : une URL tapée ne regarde pas Google.
 */
async function distantes(texte) {
  const q = String(texte).trim();
  if (!q || versUrl(q)) return [];
  // `oe=utf-8` : sans lui la réponse arrive en Latin-1 (« météo » → « m�t�o »).
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=fr&ie=utf-8&oe=utf-8&q=${encodeURIComponent(q)}`;
  try {
    const reponse = await net.fetch(url, { signal: AbortSignal.timeout(1500) });
    if (!reponse.ok) return [];
    const annonce = /charset=([\w-]+)/i.exec(reponse.headers.get('content-type') || '');
    const brut = new TextDecoder(annonce ? annonce[1] : 'utf-8').decode(await reponse.arrayBuffer());
    const [, propositions] = JSON.parse(brut);
    return (Array.isArray(propositions) ? propositions : []).filter((p) => typeof p === 'string' && p.trim()).slice(0, 4);
  } catch {
    return [];
  }
}

module.exports = { distantes };
