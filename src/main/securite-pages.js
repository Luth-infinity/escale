const { dialog, shell } = require('electron');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const { t } = require('./i18n');
const { politiqueSchema, versHttps } = require('./schemas');

/**
 * La sécurité des pages (spec §9.5 à §9.8) : permissions, périphériques,
 * schémas externes, montée en HTTPS et téléchargements.
 */

// Sans effet sur la vie privée : accordées sans question.
const AUTO = new Set(['fullscreen', 'pointerLock', 'clipboard-sanitized-write']);
// Demandées une fois par origine, par une boîte native rattachée à la fenêtre
// (une modale du shell passerait sous la page, qui est une vue native).
const SUR_DEMANDE = {
  media: 'utiliser votre caméra et votre microphone',
  geolocation: 'connaître votre position',
  notifications: 'vous envoyer des notifications',
  'clipboard-read': 'lire le contenu de votre presse-papiers',
  midi: 'accéder à vos appareils MIDI',
  midiSysex: 'piloter vos appareils MIDI',
  'idle-detection': "savoir quand vous n'utilisez pas l'ordinateur"
};

const DANGEREUX = /\.(exe|msi|msix|bat|cmd|com|scr|pif|vbs|vbe|js|jse|wsf|wsh|ps1|psm1|lnk|reg|cpl|hta|jar|dmg|pkg|mpkg|app|command|tool|sh|scpt|workflow|apk|appimage|deb|rpm)$/i;

/** À poser une fois par session d'espace. */
function brancherSession(ses, { fenetre }) {
  const reponses = new Map(); // `${origine}|${permission}` → booléen

  ses.setPermissionRequestHandler(async (wc, permission, rappel, details) => {
    if (AUTO.has(permission)) return rappel(true);
    if (!SUR_DEMANDE[permission]) return rappel(false);
    let origine;
    try {
      origine = new URL(details.requestingUrl || wc.getURL()).origin;
    } catch {
      return rappel(false);
    }
    const cle = `${origine}|${permission}`;
    if (reponses.has(cle)) return rappel(reponses.get(cle));
    const { response } = await dialog.showMessageBox(fenetre(), {
      type: 'question',
      buttons: [t('Refuser'), t('Autoriser')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      message: t('Autoriser {origine} à {action} ?', { origine, action: t(SUR_DEMANDE[permission]) }),
      detail: t("Votre réponse vaut pour cet espace, jusqu'à la fermeture d'Escale.")
    });
    reponses.set(cle, response === 1);
    rappel(response === 1);
  });

  // Le contrôle synchrone répond aussi à navigator.permissions.query(). Il doit
  // annoncer comme *possible* ce qui peut être demandé : un site qui s'y voit
  // refusé n'appelle jamais l'API et la question n'est jamais posée (leçon de
  // Hublink). Le vrai verrou reste la demande ci-dessus.
  ses.setPermissionCheckHandler((_wc, permission, origine) => {
    if (AUTO.has(permission)) return true;
    if (!SUR_DEMANDE[permission]) return false;
    const r = reponses.get(`${origine}|${permission}`);
    return r !== false;
  });

  // USB, HID, série, Bluetooth : refusés au lot 1, sans sélecteur.
  ses.setDevicePermissionHandler(() => false);
  for (const ev of ['select-hid-device', 'select-serial-port', 'select-usb-device']) {
    ses.on(ev, (e, _details, rappel) => {
      e.preventDefault();
      // Annuler le sélecteur : chaîne vide pour le port série, rien sinon.
      if (ev === 'select-serial-port') rappel('');
      else rappel();
    });
  }

  ses.on('will-download', (_e, item) => {
    const nom = item.getFilename();
    if (DANGEREUX.test(nom)) {
      item.pause();
      dialog
        .showMessageBox(fenetre(), {
          type: 'warning',
          buttons: [t('Annuler'), t('Télécharger quand même')],
          defaultId: 0,
          cancelId: 0,
          noLink: true,
          message: t('« {nom} » peut endommager votre ordinateur', { nom }),
          detail: t('Ce type de fichier peut exécuter du code. Ne le téléchargez que si vous faites confiance à {hote}.', {
            hote: hoteDe(item.getURL())
          })
        })
        .then(({ response }) => (response === 1 ? item.resume() : item.cancel()));
    }
    item.once('done', (_ev, etat) => {
      if (etat === 'completed') marquerVenantDInternet(item.getSavePath(), item.getURL(), item.getReferrer?.() || '');
    });
  });
}

function hoteDe(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Gatekeeper et SmartScreen ne contrôlent que les fichiers ainsi marqués. */
function marquerVenantDInternet(chemin, url, referent) {
  if (!chemin) return;
  if (process.platform === 'darwin') {
    const valeur = `0081;${Math.floor(Date.now() / 1000).toString(16)};Escale;`;
    execFile('xattr', ['-w', 'com.apple.quarantine', valeur, chemin], () => {});
  } else if (process.platform === 'win32') {
    const zone = `[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=${referent}\r\nHostUrl=${url}\r\n`;
    fs.writeFile(`${chemin}:Zone.Identifier`, zone, () => {});
  }
}

/**
 * Par page : schémas externes, montée en HTTPS et page d'avertissement.
 * `charger(url)` est le chargement d'Escale lui-même (déjà relevé en HTTPS).
 */
function brancherPage(wc, { fenetre, exceptionsHttp }) {
  const relevees = new Map(); // URL https tentée → URL http d'origine

  const relever = (e, url) => {
    const https = versHttps(url, exceptionsHttp);
    if (!https) return;
    e.preventDefault();
    relevees.set(https, url);
    wc.loadURL(https);
  };

  wc.on('will-frame-navigate', (e) => {
    const { url, isMainFrame } = e;
    const politique = politiqueSchema(url);
    if (politique === 'web') {
      if (isMainFrame) relever(e, url);
      return;
    }
    e.preventDefault();
    if (politique === 'interne' && isMainFrame) return interne(url);
    if (politique === 'externe' && isMainFrame) ouvrirExterne(url);
  });
  wc.on('will-redirect', (e) => {
    if (e.isMainFrame) relever(e, e.url);
  });

  wc.on('did-fail-load', (_e, code, _desc, url, principale) => {
    if (!principale || code === -3 || !relevees.has(url)) return;
    const http = relevees.get(url);
    relevees.delete(url);
    wc.loadURL(`escale://http/?url=${encodeURIComponent(http)}`);
  });

  function interne(url) {
    const u = new URL(url);
    if (u.hostname === 'continuer') {
      const http = u.searchParams.get('url') || '';
      if (!http.startsWith('http://')) return;
      exceptionsHttp.add(hoteDe(http));
      wc.loadURL(http);
    } else if (u.hostname === 'retour') {
      if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    }
  }

  async function ouvrirExterne(url) {
    const schema = url.split(':')[0];
    const { response } = await dialog.showMessageBox(fenetre(), {
      type: 'question',
      buttons: [t('Annuler'), t("Ouvrir l'application")],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      message: t('Ouvrir le lien « {schema}: » dans une autre application ?', { schema }),
      detail: hoteDe(wc.getURL())
    });
    if (response === 1) shell.openExternal(url);
  }
}

/** La page servie en escale://http/ quand un site n'a pas de HTTPS. */
function pageHttp(urlHttp) {
  const echapper = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const hote = echapper(hoteDe(urlHttp));
  const suite = `escale://continuer/?url=${encodeURIComponent(urlHttp)}`;
  return `<!doctype html><meta charset="utf-8"><title>${t('Connexion non sécurisée')}</title>
<style>
  :root { color-scheme: light dark; font: 15px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
  body { max-width: 520px; margin: 18vh auto 0; padding: 0 24px; color: CanvasText; background: Canvas; }
  h1 { font-size: 22px; margin: 0 0 12px; letter-spacing: -0.01em; }
  p { opacity: .8; margin: 0 0 24px; }
  a { display: inline-block; padding: 8px 14px; border-radius: 8px; text-decoration: none; margin-right: 8px; }
  .principal { background: CanvasText; color: Canvas; }
  .secondaire { color: inherit; border: 1px solid color-mix(in srgb, CanvasText 20%, transparent); }
</style>
<h1>${t('{hote} ne propose pas de connexion sécurisée', { hote })}</h1>
<p>${t('Ce que vous envoyez ou recevez sur ce site peut être lu ou modifié en chemin. Évitez d’y saisir un mot de passe ou des informations bancaires.')}</p>
<a class="principal" href="escale://retour/">${t('Revenir en arrière')}</a>
<a class="secondaire" href="${echapper(suite)}">${t('Continuer en HTTP')}</a>`;
}

function servirPagesInternes(ses) {
  ses.protocol.handle('escale', (requete) => {
    const u = new URL(requete.url);
    if (u.hostname !== 'http') return new Response('', { status: 404 });
    return new Response(pageHttp(u.searchParams.get('url') || ''), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'"
      }
    });
  });
}

module.exports = { brancherSession, brancherPage, servirPagesInternes, marquerVenantDInternet, DANGEREUX };
