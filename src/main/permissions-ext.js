/**
 * Ce qu'une extension pourra faire, en clair, avant de l'installer. Les phrases
 * sont en français et servent de clés à t() au moment de l'affichage : ce
 * module reste pur pour être testé sous Node.
 */
const TOUS_LES_SITES = 'Lire et modifier toutes vos données sur tous les sites';

const PHRASES = {
  tabs: 'Lire votre historique de navigation',
  history: 'Lire votre historique de navigation',
  topSites: 'Lire la liste de vos sites les plus visités',
  bookmarks: 'Lire et modifier vos favoris',
  clipboardRead: 'Lire les données que vous copiez et collez',
  clipboardWrite: 'Modifier les données que vous copiez et collez',
  cookies: 'Lire et modifier vos cookies',
  downloads: 'Gérer vos téléchargements',
  geolocation: 'Connaître votre position',
  management: 'Gérer vos applications, extensions et thèmes',
  nativeMessaging: 'Communiquer avec des applications installées sur l’ordinateur',
  notifications: 'Afficher des notifications',
  privacy: 'Modifier vos paramètres de confidentialité',
  proxy: TOUS_LES_SITES,
  debugger: TOUS_LES_SITES,
  declarativeNetRequest: 'Bloquer du contenu sur toutes les pages'
};

// API absentes d'Escale (spike du 22/10 + bouchons de electron-chrome-extensions).
const ABSENTES = new Set([
  'nativeMessaging', 'desktopCapture', 'tabCapture', 'identity', 'downloads', 'proxy',
  'declarativeNetRequest', 'declarativeNetRequestWithHostAccess', 'declarativeNetRequestFeedback'
]);

const estHote = (p) => p === '<all_urls>' || /^(\*|https?|wss?|file|ftp):\/\//.test(p);
const estTousSites = (p) => p === '<all_urls>' || /^(\*|https?):\/\/\*\/\*$/.test(p);

function hoteDe(motif) {
  const m = /^[^:]+:\/\/(?:\*\.)?([^/]+)/.exec(motif);
  return m ? m[1] : motif;
}

function permissionsDe(manifest) {
  const brutes = [...(manifest.permissions || []), ...(manifest.host_permissions || [])];
  const hotes = brutes.filter(estHote);
  for (const cs of manifest.content_scripts || []) hotes.push(...(cs.matches || []));
  return { api: brutes.filter((p) => !estHote(p)), hotes };
}

function decrire(manifest) {
  const { api, hotes } = permissionsDe(manifest);
  const phrases = [];
  if (hotes.some(estTousSites)) phrases.push(TOUS_LES_SITES);
  else if (hotes.length) {
    const sites = [...new Set(hotes.map(hoteDe))];
    phrases.push(
      sites.length === 1
        ? `Lire et modifier vos données sur ${sites[0]}`
        : `Lire et modifier vos données sur ${sites.length} sites : ${sites.slice(0, 3).join(', ')}${sites.length > 3 ? '…' : ''}`
    );
  }
  for (const p of api) if (PHRASES[p]) phrases.push(PHRASES[p]);
  return [...new Set(phrases)];
}

function manquantes(manifest) {
  const toutes = [...(manifest.permissions || []), ...(manifest.optional_permissions || [])];
  return toutes.filter((p) => ABSENTES.has(p) || p.startsWith('enterprise.'));
}

module.exports = { decrire, manquantes };
