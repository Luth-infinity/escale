/**
 * L'adresse affichée en tête de la barre latérale : le domaine enregistrable
 * en avant (c'est lui qui dit à qui l'on parle), les sous-domaines atténués.
 * Les domaines internationalisés restent en punycode, tels que Chromium les
 * parse : un « а » cyrillique ne peut pas se faire passer pour un « a ».
 */
// Suffixes publics à deux niveaux les plus courants ; le reste est traité
// comme un TLD simple. Liste volontairement courte : une erreur ne fait
// qu'atténuer un sous-domaine de trop ou de moins.
const SUFFIXES_DOUBLES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'ne.jp', 'or.jp', 'co.kr',
  'com.br', 'com.mx', 'com.ar', 'com.cn', 'com.tw', 'com.hk', 'co.in', 'co.za', 'com.tr', 'gouv.fr', 'asso.fr',
  'com.fr', 'gov.br', 'github.io', 'vercel.app', 'netlify.app', 'pages.dev', 'herokuapp.com', 'blogspot.com'
]);

export function decouperAdresse(url: string): { avant: string; domaine: string; securise: boolean } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { avant: '', domaine: url, securise: false };
  }
  const securise = u.protocol === 'https:';
  if (!u.hostname) return { avant: '', domaine: url, securise: false };
  const hote = u.hostname;
  if (/^[\d.]+$/.test(hote) || hote.startsWith('[') || !hote.includes('.')) {
    return { avant: '', domaine: u.host, securise };
  }
  const labels = hote.split('.');
  const deux = labels.slice(-2).join('.');
  const n = SUFFIXES_DOUBLES.has(deux) ? 3 : 2;
  const domaine = labels.slice(-n).join('.');
  const avant = labels.length > n ? `${labels.slice(0, -n).join('.')}.` : '';
  return { avant, domaine, securise };
}
