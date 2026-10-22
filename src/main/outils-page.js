const { dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { t, getLanguage } = require('./i18n');

/**
 * Ce qu'on fait d'une page : l'imprimer, l'enregistrer, la lire au calme, la
 * traduire, en sortir la vidéo. Tout agit sur l'onglet affiché.
 */
const nomDeFichier = (titre) => (titre || 'page').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120) || 'page';

function imprimer(wc) {
  wc.print({}, () => {});
}

async function enregistrer(wc, fenetre) {
  const { canceled, filePath } = await dialog.showSaveDialog(fenetre, {
    defaultPath: `${nomDeFichier(wc.getTitle())}.html`,
    filters: [
      { name: t('Page web complète'), extensions: ['html'] },
      { name: 'PDF', extensions: ['pdf'] }
    ]
  });
  if (canceled || !filePath) return;
  if (filePath.toLowerCase().endsWith('.pdf')) fs.writeFileSync(filePath, await wc.printToPDF({ printBackground: true }));
  else await wc.savePage(filePath, 'HTMLComplete');
}

/** La plus grande vidéo de la page passe en image dans l'image ; un second appel l'en sort. */
function imageDansImage(wc) {
  return wc.executeJavaScript(
    `(async () => {
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return 'sortie'; }
      const v = [...document.querySelectorAll('video')].filter((x) => x.readyState > 0 && !x.disablePictureInPicture)
        .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
      if (!v) return 'aucune';
      await v.requestPictureInPicture();
      return 'ok';
    })()`,
    true
  ).catch(() => 'erreur');
}

/**
 * Traduire : Chromium a son traducteur, pas Electron. La page passe par le
 * proxy de Google Traduction, vers la langue d'Escale. Une page derrière une
 * connexion n'y est pas lisible : c'est la limite.
 */
function traduire(wc) {
  const url = wc.getURL();
  if (!/^https?:/.test(url)) return;
  wc.loadURL(`https://translate.google.com/translate?sl=auto&tl=${getLanguage()}&u=${encodeURIComponent(url)}`);
}

let readability = null;
const sourceReadability = () =>
  readability || (readability = fs.readFileSync(require.resolve('@mozilla/readability/Readability.js'), 'utf8'));

const echapper = (s) => String(s || '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Le mode lecture : l'article seul, mis en page sobrement. Readability (Mozilla,
 * le mode lecture de Firefox) l'extrait dans un monde isolé ; la page de
 * lecture est une adresse data: sans aucun script (CSP), et Précédent ramène à
 * l'original.
 */
async function lecture(wc) {
  const url = wc.getURL();
  if (!/^https?:/.test(url)) return 'impossible';
  const article = await wc
    .executeJavaScriptInIsolatedWorld(1202, [
      { code: `${sourceReadability()}\n;(() => { const a = new Readability(document.cloneNode(true)).parse(); return a ? { titre: a.title, auteur: a.byline, site: a.siteName, contenu: a.content } : null; })()` }
    ])
    .catch(() => null);
  if (!article || !article.contenu) return 'impossible';
  const html = `<!doctype html><html lang="${getLanguage()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; media-src https:; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${echapper(article.titre)}</title>
<style>
  :root { color-scheme: light dark; --fond: #faf8f4; --texte: #1c1c1e; --doux: #6b6b70; --lien: #0a7a73; }
  @media (prefers-color-scheme: dark) { :root { --fond: #17181b; --texte: #e8e8ea; --doux: #9a9aa2; --lien: #3fd1c6; } }
  body { margin: 0; background: var(--fond); color: var(--texte); font: 19px/1.7 Georgia, "Iowan Old Style", serif; }
  main { max-width: 680px; margin: 0 auto; padding: 56px 24px 96px; }
  .source { font: 600 13px/1.4 "Segoe UI", system-ui, sans-serif; color: var(--doux); letter-spacing: .02em; }
  .source a { color: inherit; }
  h1 { font: 700 34px/1.2 "Segoe UI", system-ui, sans-serif; letter-spacing: -.01em; margin: 10px 0 8px; }
  .auteur { font: 14px/1.4 "Segoe UI", system-ui, sans-serif; color: var(--doux); margin-bottom: 36px; }
  img, video, figure { max-width: 100%; height: auto; border-radius: 6px; }
  figcaption { font-size: 14px; color: var(--doux); }
  a { color: var(--lien); }
  pre, code { font-size: 15px; white-space: pre-wrap; }
  blockquote { margin: 0; padding-left: 18px; border-left: 3px solid var(--doux); color: var(--doux); }
</style></head><body><main>
<div class="source"><a href="${echapper(url)}">${echapper(article.site || new URL(url).hostname)}</a></div>
<h1>${echapper(article.titre)}</h1>${article.auteur ? `<div class="auteur">${echapper(article.auteur)}</div>` : ''}
${article.contenu}
</main></body></html>`;
  await wc.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return 'ok';
}

module.exports = { imprimer, enregistrer, imageDansImage, traduire, lecture, nomDeFichier };
