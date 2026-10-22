const { app } = require('electron');

// L'UA par défaut d'Electron glisse deux jetons avant `Chrome/` : celui
// d'Electron et celui de l'application elle-même. Des sites filtrent les
// navigateurs qu'ils ne reconnaissent pas (Teams, WhatsApp) : on efface tout ce
// qui se trouve entre `(KHTML, like Gecko)` et `Chrome/`, sans nommer ces
// jetons. Ce qui reste est un UA Chrome authentique, même moteur et même version.
const CHROME_UA = app.userAgentFallback
  .replace(/(\(KHTML, like Gecko\)\s*).*?(Chrome\/)/, '$1$2')
  .replace(/ Electron\/[\d.]+/g, '');

module.exports = { CHROME_UA };
