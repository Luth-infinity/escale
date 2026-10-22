const { app, Menu } = require('electron');
const { t } = require('./i18n');

/**
 * Le menu natif et ses raccourcis. Les commandes d'interface (barre de
 * commande, recherche dans la page, repli de la barre) partent au shell par un
 * delta `ui:commande` ; les autres appellent directement une action.
 *
 * Un menu d'application reçoit les raccourcis même quand le clavier est dans
 * une page web : c'est ce qui fait marcher Cmd+T depuis n'importe quel site.
 */
function construire({ agir, ui, onglets, etat }) {
  const mac = process.platform === 'darwin';
  const espaces = etat.lire().espaces.slice(0, 9);
  const devtools = () => {
    const id = onglets.courantId();
    onglets.webContentsDe(id)?.toggleDevTools();
  };
  const fermerCourant = () => {
    const id = onglets.courantId();
    if (id) agir('onglet.fermer', { id });
  };

  const modele = [
    ...(mac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: t('À propos d’Escale') },
              { type: 'separator' },
              { label: t('Réglages…'), accelerator: 'Cmd+,', click: () => ui('reglages') },
              { type: 'separator' },
              { role: 'hide', label: t('Masquer Escale') },
              { role: 'hideOthers', label: t('Masquer les autres') },
              { role: 'unhide', label: t('Tout afficher') },
              { type: 'separator' },
              { role: 'quit', label: t('Quitter Escale') }
            ]
          }
        ]
      : []),
    {
      label: t('Fichier'),
      submenu: [
        { label: t('Nouvel onglet'), accelerator: 'CmdOrCtrl+T', click: () => ui('nouvel-onglet') },
        { label: t('Rouvrir l’onglet fermé'), accelerator: 'CmdOrCtrl+Shift+T', click: () => agir('onglet.restaurer', {}) },
        { label: t('Fermer l’onglet'), accelerator: 'CmdOrCtrl+W', click: fermerCourant },
        { type: 'separator' },
        { label: t('Ouvrir une adresse'), accelerator: 'CmdOrCtrl+L', click: () => ui('adresse') },
        ...(mac ? [] : [{ type: 'separator' }, { label: t('Réglages…'), accelerator: 'Ctrl+,', click: () => ui('reglages') }, { role: 'quit', label: t('Quitter') }])
      ]
    },
    { role: 'editMenu', label: t('Édition') },
    {
      label: t('Affichage'),
      submenu: [
        { label: t('Rechercher dans la page'), accelerator: 'CmdOrCtrl+F', click: () => ui('chercher') },
        { type: 'separator' },
        { label: t('Recharger'), accelerator: 'CmdOrCtrl+R', click: () => agir('nav.recharger', {}) },
        { label: t('Recharger sans le cache'), accelerator: 'CmdOrCtrl+Shift+R', click: () => agir('nav.recharger', { sansCache: true }) },
        { type: 'separator' },
        { label: t('Zoom avant'), accelerator: 'CmdOrCtrl+=', click: () => agir('page.zoom', { sens: 'plus' }) },
        { label: t('Zoom arrière'), accelerator: 'CmdOrCtrl+-', click: () => agir('page.zoom', { sens: 'moins' }) },
        { label: t('Taille réelle'), accelerator: 'CmdOrCtrl+0', click: () => agir('page.zoom', { sens: 'normal' }) },
        { type: 'separator' },
        { label: t('Replier la barre latérale'), accelerator: 'CmdOrCtrl+S', click: () => ui('replier') },
        { label: t('Outils de développement'), accelerator: mac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', click: devtools },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('Plein écran') }
      ]
    },
    {
      label: t('Navigation'),
      submenu: [
        { label: t('Précédent'), accelerator: 'CmdOrCtrl+[', click: () => agir('nav.precedent', {}) },
        { label: t('Suivant'), accelerator: 'CmdOrCtrl+]', click: () => agir('nav.suivant', {}) },
        { type: 'separator' },
        ...espaces.map((e, i) => ({
          label: e.nom,
          accelerator: `Ctrl+${i + 1}`,
          click: () => agir('espace.activer', { id: e.id })
        }))
      ]
    },
    { role: 'windowMenu', label: t('Fenêtre') }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(modele));
}

module.exports = { construire };
