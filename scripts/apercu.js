/* Outil de dev : remplit un profil jetable et capture le shell et la page. */
const fs = require('node:fs');

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function apercu({ fenetre, onglets, etat, agir, sortie }) {
  const e = etat.lire();
  if (e.onglets.length === 0) {
    const esp = e.espaceActif;
    agir('espace.modifier', { id: esp, teinte: '#3a7f6b' });
    const travail = agir('dossier.creer', { nom: 'Travail' });
    const lectures = agir('dossier.creer', { nom: 'Lectures' });
    agir('dossier.teinte', { id: lectures, teinte: '#b5523b' });
    const epingler = (url, dossierId) => {
      const id = etat.appliquer('ouvrirOnglet', { espaceId: esp, url }).deltas[0].onglet.id;
      if (dossierId) etat.appliquer('deplacer', { id, type: 'onglet', dossierId });
      else etat.appliquer('epingler', id, true);
      return id;
    };
    epingler('https://github.com/');
    epingler('https://www.figma.com/', travail);
    epingler('https://linear.app/', travail);
    epingler('https://fr.wikipedia.org/wiki/Escale', lectures);
    agir('dossier.replier', { id: lectures, oui: true });
    for (const url of ['https://example.com/', 'https://www.lemonde.fr/', 'https://developer.mozilla.org/fr/']) {
      onglets.ouvrir(esp, url, { actif: false });
    }
    onglets.ouvrir(esp, 'https://fr.wikipedia.org/wiki/Navigateur_web', { actif: true });
    agir('espace.creer', { nom: 'Boulot', teinte: '#3b6fb6' });
    agir('espace.activer', { id: esp });
  }
  await attendre(6000);
  const diag = await fenetre.webContents.executeJavaScript(
    "JSON.stringify({ html: document.getElementById('root').innerHTML.length, escale: typeof window.escale, bal: !!customElements.get('browser-action-list') })"
  );
  console.log('DIAG', diag);
  const vue = fenetre.contentView.children[0];
  console.log('VUE', JSON.stringify({ n: fenetre.contentView.children.length, bounds: vue?.getBounds(), visible: vue?.getVisible?.(), url: vue?.webContents?.getURL() }));
  const shell = await fenetre.webContents.capturePage();
  fs.writeFileSync(`${sortie}-shell.png`, shell.toPNG());
  const id = onglets.courantId();
  if (id) fs.writeFileSync(`${sortie}-page.png`, (await onglets.webContentsDe(id).capturePage()).toPNG());
  if (!process.argv.includes('--garder')) require('electron').app.exit(0);
};
