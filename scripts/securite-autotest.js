/* Banc de sécurité, lancé dans l'app de dev par scripts/test-securite.js. */
const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const avant = (ms, p, nom) => Promise.race([p, attendre(ms).then(() => { throw new Error(`délai dépassé : ${nom}`); })]);

module.exports = async function autotest({ fenetre, onglets, etat }) {
  const resultats = [];
  const verifier = async (nom, fn) => {
    try {
      const detail = await fn();
      resultats.push({ nom, ok: true, detail });
    } catch (e) {
      resultats.push({ nom, ok: false, detail: e.message });
    }
  };
  const espace = etat.lire().espaces[0];
  const sesA = session.fromPartition(espace.partition);
  const nouvelOnglet = async (url) => {
    const id = onglets.ouvrir(espace.id, url, { actif: true });
    const vue = await onglets.assurerVue(id);
    await avant(20000, new Promise((r) => (vue.webContents.isLoading() ? vue.webContents.once('did-stop-loading', r) : r())), url);
    return { id, wc: vue.webContents };
  };

  await verifier('une page qui appelle l’IPC du shell est refusée', async () => {
    const w = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'autotest-preload.js'), sandbox: true } });
    await w.loadURL('data:text/html,<p>sonde</p>');
    const r = await w.webContents.executeJavaScript(`Promise.all([
      window.sonde.invoke('etat:initial', {}).then(() => 'accepte', (e) => e.message),
      window.sonde.invoke('action', { nom: 'layout.zone', payload: {} }).then(() => 'accepte', (e) => e.message)
    ])`);
    w.destroy();
    if (!r.every((m) => /expediteur-refuse/.test(m))) throw new Error(JSON.stringify(r));
    return r;
  });

  await verifier('un certificat expiré ne charge pas', async () => {
    const id = onglets.ouvrir(espace.id, 'about:blank', { actif: true });
    const { webContents: wc } = await onglets.assurerVue(id);
    const echec = new Promise((r) => wc.on('did-fail-load', (_e, code, _d, url, principale) => principale && r({ code, url })));
    wc.loadURL('https://expired.badssl.com/').catch(() => {});
    const { code } = await avant(20000, echec, 'did-fail-load');
    if (code > -200 || code <= -300) throw new Error(`code ${code}`);
    return `code ${code}`;
  });

  const { id: idPage, wc } = await nouvelOnglet('https://example.com/');

  await verifier('une adresse http est relevée en https', async () => {
    const { wc: w2 } = await nouvelOnglet('http://example.com/');
    if (!w2.getURL().startsWith('https://example.com')) throw new Error(w2.getURL());
    return w2.getURL();
  });

  await verifier('la permission HID est refusée', async () => {
    const r = await wc.executeJavaScript(
      "navigator.hid ? navigator.hid.requestDevice({ filters: [] }).then((d) => 'appareils:' + d.length, (e) => 'erreur:' + e.name) : 'absente'",
      true
    );
    if (!/^(appareils:0|erreur:|absente)/.test(r)) throw new Error(r);
    return r;
  });

  await verifier('file:// est bloqué depuis une page', async () => {
    await wc.executeJavaScript("location.href = 'file:///etc/hosts'; 1", true);
    await attendre(800);
    if (!wc.getURL().startsWith('https://example.com')) throw new Error(wc.getURL());
    return wc.getURL();
  });

  await verifier('une popup de l’espace A garde la session de A', async () => {
    const creee = new Promise((r) => app.once('browser-window-created', (_e, w) => r(w)));
    await wc.executeJavaScript("window.open('https://example.com/?popup', 'p', 'width=400,height=300'); 1", true);
    const w = await avant(5000, creee, 'popup');
    const meme = w.webContents.session === sesA;
    w.destroy();
    if (!meme) throw new Error('autre session');
    return 'même session';
  });

  await verifier('target=_blank ouvre un onglet du même espace, sous l’ouvreur', async () => {
    const avantN = etat.lire().onglets.length;
    await wc.executeJavaScript(
      "const a = document.createElement('a'); a.href = 'https://example.com/?blank'; a.target = '_blank'; document.body.append(a); a.click(); 1",
      true
    );
    await attendre(500);
    const e = etat.lire();
    const o = e.onglets.find((x) => x.url === 'https://example.com/?blank');
    if (!o || e.onglets.length !== avantN + 1 || o.espaceId !== espace.id) throw new Error('onglet absent');
    const jour = e.onglets.filter((x) => !x.epingle).sort((a, b) => (a.ordre < b.ordre ? -1 : 1)).map((x) => x.id);
    if (jour[jour.indexOf(idPage) + 1] !== o.id) throw new Error('pas sous l’ouvreur');
    return 'ok';
  });

  await verifier('trois afficher() rapides : le dernier gagne', async () => {
    const ids = ['https://example.com/?1', 'https://example.com/?2', 'https://example.com/?3'].map((u) =>
      etat.appliquer('ouvrirOnglet', { espaceId: espace.id, url: u }).deltas[0].onglet.id
    );
    await Promise.all(ids.map((id) => onglets.afficher(id)));
    const vuesAffichees = fenetre.contentView.children.length;
    if (onglets.courantId() !== ids[2]) throw new Error(`courant ${onglets.courantId()}`);
    if (vuesAffichees !== 1) throw new Error(`${vuesAffichees} vues dans la fenêtre`);
    return 'ok';
  });

  await verifier('Dark Reader s’installe (CRX vérifié) et assombrit une page', async () => {
    const crx = require('../src/main/crx');
    const verifierOrigine = crx.verifier;
    let verifications = 0;
    crx.verifier = (...a) => {
      verifications++;
      return verifierOrigine(...a);
    };
    const { installExtension } = require('electron-chrome-web-store');
    await installExtension('eimadpbcbfnmbkopoojfekhnkhdbieeh', { session: sesA, extensionsPath: path.join(app.getPath('userData'), 'Extensions') });
    crx.verifier = verifierOrigine;
    if (verifications < 1) throw new Error('le CRX n’est pas passé par la vérification');
    await attendre(3000);
    const { wc: w3 } = await nouvelOnglet('https://example.com/?sombre');
    await attendre(2500);
    const fond = await w3.executeJavaScript("getComputedStyle(document.documentElement).backgroundColor + ' ' + !!document.querySelector('style.darkreader')");
    if (!/true$/.test(fond)) throw new Error(fond);
    return `${verifications} vérification(s), ${fond}`;
  });

  const echecs = resultats.filter((r) => !r.ok);
  process.stdout.write(`\nRESULTATS ${JSON.stringify(resultats)}\n`);
  app.exit(echecs.length ? 1 : 0);
};
