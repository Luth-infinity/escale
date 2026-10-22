const { app, dialog, BrowserWindow } = require('electron');
const path = require('node:path');
const crx = require('./crx');
const P = require('./permissions-ext');
const { t } = require('./i18n');

/**
 * Les extensions Chrome, par electron-chrome-extensions (API chrome.*) et
 * electron-chrome-web-store (installation et mises à jour depuis le Store).
 *
 * Toutes les sessions d'espace partagent le même dossier d'extensions : une
 * extension installée dans un espace est chargée dans tous les autres.
 */

// La lib du Store télécharge avec le `fetch` global, capturé au chargement du
// module. On lui en prête un qui vérifie la signature de tout paquet CRX qui
// passe (installation comme mise à jour), puis on rend le vrai.
const fetchOrigine = globalThis.fetch;
globalThis.fetch = async function fetchVerifie(...args) {
  const r = await fetchOrigine(...args);
  if (!r.ok) return r;
  const corps = Buffer.from(await r.arrayBuffer());
  if (corps.subarray(0, 4).toString('binary') === 'Cr24') {
    const v = crx.verifier(corps);
    if (!v.ok) throw new Error(`Paquet d'extension refusé : ${v.raison}`);
  }
  return new Response(corps, { status: r.status, statusText: r.statusText, headers: r.headers });
};
const store = require('electron-chrome-web-store');
globalThis.fetch = fetchOrigine;
const { ElectronChromeExtensions } = require('electron-chrome-extensions');

const branchees = new Map(); // session → { ece, prive }
// La lib rappelle selectTab même quand c'est nous qui l'informons (addTab marque
// l'onglet ajouté comme actif). Seuls les appels venus d'une extension
// (chrome.tabs.update…) doivent remonter au pont.
let interne = false;
const enInterne = (f) => {
  interne = true;
  try {
    return f();
  } finally {
    interne = false;
  }
};
let pont = null;
let premiere = null;
const dossier = () => path.join(app.getPath('userData'), 'Extensions');

/**
 * Le gestionnaire d'onglets se présente ici, pour que les extensions puissent
 * ouvrir, activer et fermer des onglets.
 * { creerOnglet(details, session) → Promise<[WebContents, BaseWindow]>,
 *   activerOnglet(wc), fermerOnglet(wc), fenetre() → BaseWindow }
 */
function definirPont(p) {
  pont = p;
}

async function demanderAccord({ localizedName, manifest, browserWindow }) {
  const peut = P.decrire(manifest).map((p) => `• ${t(p)}`);
  const absentes = P.manquantes(manifest);
  const detail = [
    peut.length ? `${t('Elle pourra :')}\n${peut.join('\n')}` : t('Elle ne demande aucune permission sensible.'),
    absentes.length ? t('Ne fonctionnera pas entièrement dans Escale : {api}', { api: absentes.join(', ') }) : ''
  ].filter(Boolean).join('\n\n');
  const parent = browserWindow || BrowserWindow.getFocusedWindow() || pont?.fenetre();
  const { response } = await dialog.showMessageBox(parent, {
    type: 'question',
    message: t('Ajouter « {nom} » ?', { nom: localizedName }),
    detail,
    buttons: [t('Annuler'), t("Ajouter l'extension")],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  return { action: response === 1 ? 'allow' : 'deny' };
}

// Une extension chargée (installée ou mise à jour) dans un espace l'est dans
// tous les autres, à la même version.
function propager(ext, depuis) {
  for (const [ses, { prive }] of branchees) {
    if (ses === depuis || prive) continue;
    const deja = ses.extensions.getExtension(ext.id);
    if (deja && deja.version === ext.version) continue;
    if (deja) ses.extensions.removeExtension(ext.id);
    ses.extensions.loadExtension(ext.path).catch((e) => console.error('extension', ext.id, e.message));
  }
}

/** À appeler avant le premier loadURL d'une session. */
async function brancherSession(ses, { prive = false } = {}) {
  if (branchees.has(ses)) return;
  const ece = new ElectronChromeExtensions({
    license: 'GPL-3.0',
    session: ses,
    createTab: (details) => pont.creerOnglet(details, ses),
    selectTab: (wc) => !interne && pont.activerOnglet(wc),
    removeTab: (wc) => pont.fermerOnglet(wc),
    createWindow: async (details) => {
      const url = [].concat(details.url || [])[0];
      if (url) await pont.creerOnglet({ url, active: true }, ses);
      return pont.fenetre();
    }
  });
  branchees.set(ses, { ece, prive });
  // Une seule session vérifie les mises à jour : elles écrivent toutes dans le
  // même dossier, et la propagation met les autres à niveau.
  const majAuto = !prive && !premiere;
  if (!prive && !premiere) premiere = ses;
  await store.installChromeWebStore({
    session: ses,
    extensionsPath: dossier(),
    loadExtensions: !prive,
    autoUpdate: majAuto,
    beforeInstall: demanderAccord
  });
  if (!prive) ses.extensions.on('extension-loaded', (_e, ext) => propager(ext, ses));
}

const sessionDe = (wc) => [...branchees].find(([ses]) => ses === wc.session)?.[1];

function ajouterOnglet(wc, fenetre) {
  enInterne(() => sessionDe(wc)?.ece.addTab(wc, fenetre));
}
function retirerOnglet(wc) {
  sessionDe(wc)?.ece.removeTab(wc);
}
function activerOnglet(wc) {
  enInterne(() => sessionDe(wc)?.ece.selectTab(wc));
}
function menuContextuel(wc, params) {
  return sessionDe(wc)?.ece.getContextMenuItems(wc, params) || [];
}

async function retirer(id) {
  for (const ses of branchees.keys()) if (ses.extensions.getExtension(id)) ses.extensions.removeExtension(id);
  if (premiere) await store.uninstallExtension(id, { session: premiere, extensionsPath: dossier() }).catch(() => {});
}

function lister() {
  if (!premiere) return [];
  return premiere.extensions.getAllExtensions().map((e) => ({
    id: e.id,
    nom: e.name,
    version: e.version,
    permissions: P.decrire(e.manifest),
    manquantes: P.manquantes(e.manifest)
  }));
}

/** Les icônes servies en crx:// au shell (session par défaut). */
function brancherShell(ses) {
  ElectronChromeExtensions.handleCRXProtocol(ses);
}

module.exports = {
  definirPont, brancherSession, brancherShell, ajouterOnglet, retirerOnglet, activerOnglet, menuContextuel,
  retirer, lister
};
