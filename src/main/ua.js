const { app } = require('electron');

// L'UA par défaut d'Electron glisse deux jetons avant `Chrome/` : celui
// d'Electron et celui de l'application elle-même. Des sites filtrent les
// navigateurs qu'ils ne reconnaissent pas (Teams, WhatsApp) : on efface tout ce
// qui se trouve entre `(KHTML, like Gecko)` et `Chrome/`, sans nommer ces
// jetons. Ce qui reste est un UA Chrome authentique, même moteur et même version.
const APP_UA = app.userAgentFallback;
const CHROME_UA = APP_UA
  .replace(/(\(KHTML, like Gecko\)\s*).*?(Chrome\/)/, '$1$2')
  .replace(/ Electron\/[\d.]+/g, '');

// La connexion Google, elle, refuse cet UA « Chrome » : la page vérifie que le
// navigateur est bien ce qu'il dit, voit un Chromium sans l'empreinte de Chrome
// et répond « Ce navigateur ou cette application ne sont peut-être pas
// sécurisés ». Présenté tel qu'il est (Escale, Electron), le navigateur reçoit
// le parcours de connexion allégé de Google, qui aboutit. Sur ces pages, Escale
// dit donc la vérité.
const HOTES_UA_REEL = new Set(['accounts.google.com']);

function uaPour(url) {
  try {
    return HOTES_UA_REEL.has(new URL(url).hostname) ? APP_UA : CHROME_UA;
  } catch {
    return CHROME_UA;
  }
}

/** Règle l'UA de la page à chaque navigation principale. */
function suivre(wc) {
  wc.on('did-start-navigation', (d) => {
    if (!d.isMainFrame || d.isSameDocument) return;
    const ua = uaPour(d.url);
    if (wc.getUserAgent() !== ua) wc.setUserAgent(ua);
  });
}

module.exports = { CHROME_UA, suivre };
