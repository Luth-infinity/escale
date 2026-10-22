const { Menu, clipboard } = require('electron');
const { t } = require('./i18n');

/**
 * Les menus du clic droit dans la barre latérale. Natifs : un menu dessiné
 * dans le shell passerait sous la page (vue native) dès qu'il déborde.
 */
const COULEURS = [
  ['Vert d’eau', '#3a7f6b'], ['Bleu', '#3b6fb6'], ['Violet', '#6d5bb8'], ['Rose', '#b9577c'],
  ['Brique', '#b5523b'], ['Ocre', '#a9832c'], ['Olive', '#5c7a3a'], ['Ardoise', '#5b6472']
];

function sousMenuCouleurs(actuelle, choisir) {
  return [
    { label: t('Aucune'), type: 'radio', checked: !actuelle, click: () => choisir(null) },
    { type: 'separator' },
    ...COULEURS.map(([nom, hex]) => ({ label: t(nom), type: 'radio', checked: actuelle === hex, click: () => choisir(hex) }))
  ];
}

function declarer({ action, agir, ui, etat, fenetre }) {
  const id36 = { type: 'objet', champs: { id: { type: 'string', max: 36 } } };
  const montrer = (modele) => Menu.buildFromTemplate(modele).popup({ window: fenetre() });

  action('menu.onglet', id36, ({ id }) => {
    const o = etat.lire().onglets.find((x) => x.id === id);
    if (!o) return;
    // Les dossiers de l'espace de l'onglet, par ordre alphabétique.
    const dossiers = etat
      .lire()
      .dossiers.filter((d) => d.espaceId === o.espaceId)
      .sort((a, b) => a.nom.localeCompare(b.nom));
    const vers = (dossierId) => agir('onglet.deplacer', { id, type: 'onglet', dossierId });
    montrer([
      { label: o.epingle ? t('Désépingler') : t('Épingler'), click: () => agir('onglet.epingler', { id, oui: !o.epingle }) },
      {
        label: t('Déplacer vers un dossier'),
        submenu: [
          ...dossiers.map((d) => ({ label: d.nom, type: 'radio', checked: o.dossierId === d.id, click: () => vers(d.id) })),
          ...(dossiers.length ? [{ type: 'separator' }] : []),
          ...(o.dossierId ? [{ label: t('Sortir du dossier'), click: () => vers(null) }] : []),
          {
            label: t('Nouveau dossier'),
            click: () => {
              const dossierId = agir('dossier.creer', { espaceId: o.espaceId, nom: t('Nouveau dossier') });
              vers(dossierId);
              ui('renommer', dossierId);
            }
          }
        ]
      },
      { label: t('Dupliquer'), click: () => agir('onglet.dupliquer', { id }) },
      { label: o.muet ? t('Rétablir le son') : t('Couper le son'), click: () => agir('onglet.muet', { id, oui: !o.muet }) },
      { label: t("Copier l'adresse"), click: () => clipboard.writeText(o.url) },
      { type: 'separator' },
      { label: t("Fermer l'onglet"), click: () => agir('onglet.fermer', { id }) }
    ]);
  });

  action('menu.dossier', id36, ({ id }) => {
    const d = etat.lire().dossiers.find((x) => x.id === id);
    if (!d) return;
    montrer([
      { label: t('Renommer'), click: () => ui('renommer', id) },
      {
        label: t('Nouveau sous-dossier'),
        click: () => ui('renommer', agir('dossier.creer', { espaceId: d.espaceId, parentId: id, nom: t('Nouveau dossier') }))
      },
      { label: t('Couleur'), submenu: sousMenuCouleurs(d.teinte, (teinte) => agir('dossier.teinte', { id, teinte })) },
      { type: 'separator' },
      { label: t('Supprimer le dossier'), click: () => agir('dossier.supprimer', { id }) }
    ]);
  });

  action('menu.espace', id36, ({ id }) => {
    const e = etat.lire().espaces.find((x) => x.id === id);
    if (!e) return;
    montrer([
      { label: t('Renommer'), click: () => ui('renommer-espace', id) },
      { label: t('Couleur'), submenu: sousMenuCouleurs(e.teinte, (teinte) => agir('espace.modifier', { id, teinte })) },
      { label: t('Nouveau dossier'), click: () => ui('renommer', agir('dossier.creer', { espaceId: id, nom: t('Nouveau dossier') })) },
      { type: 'separator' },
      { label: t("Supprimer l'espace"), enabled: etat.lire().espaces.length > 1, click: () => agir('espace.supprimer', { id }) }
    ]);
  });
}

module.exports = { declarer, COULEURS };
