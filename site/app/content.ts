/**
 * Les textes du site, dans les deux langues. La page est écrite une seule fois
 * (`vitrine.tsx`) et lit le dictionnaire de la langue servie.
 */

export type Langue = 'fr' | 'en';

type Bloc = { titre: string; texte: string };

/** Un espace de la démo : sa couleur, ses épinglés, ses dossiers, ses onglets. */
export type Espace = {
  nom: string;
  couleur: string;
  epingles: string[];
  dossier: { nom: string; onglets: Onglet[] };
  onglets: Onglet[];
};
export type Onglet = { titre: string; domaine: string };

export type Contenu = {
  meta: { title: string; description: string };
  nav: { fonctions: string; securite: string; telecharger: string; langue: string };
  hero: { badge: string; titre: string; texte: string; telecharger: string; code: string };
  demo: { label: string; espaces: Espace[]; aujourdhui: string; astuce: string };
  fonctions: { titre: string; items: Bloc[] };
  commande: {
    titre: string;
    texte: string;
    saisie: string;
    lignes: { type: string; texte: string }[];
    prefixes: { cle: string; texte: string }[];
  };
  chiffres: { titre: string; sous: string; items: { valeur: string; texte: string }[] };
  extensions: { titre: string; texte: string; lignes: { nom: string; etat: string }[]; note: string };
  securite: { titre: string; texte: string; items: Bloc[]; reseau: string };
  telecharger: {
    titre: string;
    texte: string;
    mac: string;
    win: string;
    noteMac: string;
    noteWin: string;
    toutes: string;
  };
  pied: { suite: string };
};

const ESPACES_FR: Espace[] = [
  {
    nom: 'Perso',
    couleur: '#3a7f6b',
    epingles: ['M', 'A', 'S', 'N'],
    dossier: {
      nom: 'Week-end à Lisbonne',
      onglets: [
        { titre: 'Trains Paris – Lisbonne', domaine: 'sncf-connect.com' },
        { titre: 'Alfama, que voir', domaine: 'wikivoyage.org' }
      ]
    },
    onglets: [
      { titre: 'Météo de la semaine', domaine: 'meteofrance.com' },
      { titre: 'Risotto aux champignons', domaine: 'marmiton.org' }
    ]
  },
  {
    nom: 'Travail',
    couleur: '#3b6fb6',
    epingles: ['F', 'L', 'S', 'D'],
    dossier: {
      nom: 'Refonte du tableau de bord',
      onglets: [
        { titre: 'Maquettes V2', domaine: 'figma.com' },
        { titre: 'Retours du client', domaine: 'linear.app' }
      ]
    },
    onglets: [
      { titre: 'Boîte de réception', domaine: 'mail.proton.me' },
      { titre: 'Point d’équipe, notes', domaine: 'notion.so' }
    ]
  },
  {
    nom: 'Projets',
    couleur: '#a9832c',
    epingles: ['G', 'V', 'Y'],
    dossier: {
      nom: 'Navigateur',
      onglets: [
        { titre: 'electron/electron, versions', domaine: 'github.com' },
        { titre: 'Chromium security notes', domaine: 'chromium.org' }
      ]
    },
    onglets: [{ titre: 'Tutoriel de céramique', domaine: 'youtube.com' }]
  }
];

const ESPACES_EN: Espace[] = [
  {
    ...ESPACES_FR[0],
    nom: 'Personal',
    dossier: {
      nom: 'Weekend in Lisbon',
      onglets: [
        { titre: 'Trains Paris – Lisbon', domaine: 'thetrainline.com' },
        { titre: 'Alfama, what to see', domaine: 'wikivoyage.org' }
      ]
    },
    onglets: [
      { titre: 'This week’s weather', domaine: 'bbc.co.uk' },
      { titre: 'Mushroom risotto', domaine: 'bbcgoodfood.com' }
    ]
  },
  {
    ...ESPACES_FR[1],
    nom: 'Work',
    dossier: {
      nom: 'Dashboard redesign',
      onglets: [
        { titre: 'Mockups V2', domaine: 'figma.com' },
        { titre: 'Client feedback', domaine: 'linear.app' }
      ]
    },
    onglets: [
      { titre: 'Inbox', domaine: 'mail.proton.me' },
      { titre: 'Team sync, notes', domaine: 'notion.so' }
    ]
  },
  {
    ...ESPACES_FR[2],
    nom: 'Projects',
    dossier: { ...ESPACES_FR[2].dossier, nom: 'Browser' },
    onglets: [{ titre: 'Pottery tutorial', domaine: 'youtube.com' }]
  }
];

export const fr: Contenu = {
  meta: {
    title: 'Escale — le navigateur à onglets verticaux',
    description:
      'Onglets verticaux, dossiers, espaces séparés et extensions du Chrome Web Store, dans un navigateur rapide et sans télémétrie. Gratuit, pour macOS et Windows.'
  },
  nav: { fonctions: 'Fonctions', securite: 'Sécurité', telecharger: 'Télécharger', langue: 'Langue' },
  hero: {
    badge: 'Version {v} · macOS et Windows',
    titre: 'Vos onglets, rangés sur le côté.',
    texte:
      'Escale aligne vos onglets à la verticale, les range dans des dossiers et sépare vos vies dans des espaces qui ont chacun leur couleur et leurs connexions. Les extensions Chrome suivent.',
    telecharger: 'Télécharger',
    code: 'Voir le code'
  },
  demo: {
    label: 'Démonstration de la fenêtre d’Escale',
    espaces: ESPACES_FR,
    aujourdhui: 'Aujourd’hui',
    astuce: 'Changez d’espace en bas de la barre : la fenêtre prend sa couleur.'
  },
  fonctions: {
    titre: 'Ce qu’il fait',
    items: [
      {
        titre: 'Onglets verticaux',
        texte:
          'Les titres se lisent en entier. Épinglés en haut, onglets du jour en dessous : ceux qu’on n’ouvre plus se ferment seuls après 12 h, réglable.'
      },
      {
        titre: 'Dossiers',
        texte: 'Imbriqués, repliables, colorés. On y glisse un onglet, il y reste d’une session à l’autre.'
      },
      {
        titre: 'Espaces',
        texte:
          'Chaque espace a sa propre session : ses cookies, ses connexions, sa couleur. Deux comptes Google côte à côte, sans se déconnecter. On passe de l’un à l’autre à deux doigts sur le trackpad.'
      },
      {
        titre: 'Extensions Chrome',
        texte:
          'Installées depuis le Chrome Web Store, signature du paquet vérifiée, permissions expliquées en clair avant d’installer.'
      },
      {
        titre: 'Barre de commande',
        texte: '⌘T ou ⌘L : onglets ouverts, épinglés, historique, adresse ou recherche, au même endroit.'
      },
      {
        titre: 'Rien d’instantané, rien de lent',
        texte:
          'Chaque geste se termine par un mouvement court et interruptible : on voit d’où vient l’onglet et où il va. Avec « réduire les animations », tout devient un fondu.'
      },
      {
        titre: 'La vidéo à part',
        texte:
          'Sur n’importe quel site, une vidéo sort dans une petite fenêtre qui reste au-dessus de tout : avancer, reculer, régler le son, la glisser, l’agrandir.'
      },
      {
        titre: 'À votre image',
        texte:
          'Couleur d’accent, teinte des espaces, page encadrée ou bord à bord, largeur de la barre, et une photo pour chaque espace. Fermée, la barre se réduit à ses icônes.'
      }
    ]
  },
  commande: {
    titre: 'Une seule barre pour tout trouver',
    texte:
      'Tapez quelques lettres : Escale cherche dans vos onglets ouverts, vos épinglés et votre historique avant d’aller sur le web. Un préfixe envoie la recherche au bon endroit.',
    saisie: 'yt céramique',
    lignes: [
      { type: 'YouTube', texte: 'Rechercher « céramique »' },
      { type: 'Onglet ouvert', texte: 'Tutoriel de céramique' },
      { type: 'Historique', texte: 'Initiation à la céramique' }
    ],
    prefixes: [
      { cle: 'yt', texte: 'YouTube' },
      { cle: 'gh', texte: 'GitHub' },
      { cle: 'w', texte: 'Wikipédia' },
      { cle: 'g', texte: 'Google' }
    ]
  },
  chiffres: {
    titre: 'Mesuré, pas promis',
    sous: 'Relevés le 22 octobre 2026 sur un MacBook Apple Silicon, avec le banc de mesure livré dans le dépôt.',
    items: [
      { valeur: '356 ms', texte: 'du lancement à la barre latérale à l’écran' },
      { valeur: '34 ms', texte: 'entre ⌘T et la barre de commande' },
      { valeur: '0 Ko/s', texte: 'de messages internes au repos, 10 onglets ouverts' },
      { valeur: '6,9 ms', texte: 'par image en faisant défiler 300 onglets' }
    ]
  },
  extensions: {
    titre: 'Les extensions, sans enjoliver',
    texte:
      'Escale réimplémente une partie des API chrome.* : la plupart des extensions marchent, pas toutes. Escale prévient avant d’installer une extension qui dépend d’une API absente.',
    lignes: [
      { nom: 'Dark Reader', etat: 'Fonctionne' },
      { nom: 'Bitwarden', etat: 'S’installe, fenêtre fonctionnelle, remplissage à confirmer' },
      { nom: 'Bloqueurs MV3 (uBlock Origin Lite, AdGuard)', etat: 'Remplacés par le bloqueur intégré' }
    ],
    note: 'Pas encore disponibles : declarativeNetRequest, identity, downloads, nativeMessaging.'
  },
  securite: {
    titre: 'La sécurité d’abord',
    texte:
      'Un navigateur ouvre tout le web sur votre machine. Escale part donc du plus fermé et n’ouvre que ce qu’il faut.',
    items: [
      {
        titre: 'Moteur à jour',
        texte: 'Les correctifs de sécurité d’Electron arrivent sous 72 h pour une faille critique, sous deux semaines pour les autres.'
      },
      {
        titre: 'Pages cloisonnées',
        texte: 'Bac à sable et isolation partout, aucun accès à Node. Seule la barre latérale parle au reste de l’application, par une liste fermée d’actions.'
      },
      {
        titre: 'HTTPS d’office',
        texte: 'Les adresses passent en HTTPS (sauf réseau local), les certificats invalides sont refusés, le DNS est chiffré quand c’est possible.'
      },
      {
        titre: 'Permissions sur demande',
        texte: 'Caméra, micro, position, notifications et presse-papiers se demandent site par site. USB, Bluetooth et ports série sont refusés.'
      },
      {
        titre: 'Extensions vérifiées',
        texte: 'Signature CRX3 contrôlée à l’installation comme à chaque mise à jour, et aucun accès aux fichiers locaux.'
      },
      {
        titre: 'Téléchargements marqués',
        texte: 'Chaque fichier reçu porte la marque « venant d’Internet », et les exécutables sont signalés avant ouverture.'
      }
    ],
    reseau:
      'Aucune télémétrie. De lui-même, Escale ne contacte que GitHub pour les mises à jour, les suggestions de recherche (désactivables) et le Chrome Web Store si vous installez une extension.'
  },
  telecharger: {
    titre: 'Télécharger Escale',
    texte: 'Gratuit. Aucun compte à créer.',
    mac: 'macOS · Apple Silicon',
    win: 'Windows · x64',
    noteMac:
      'L’application n’est pas encore signée. Au premier lancement, ouvrez le Terminal et lancez : xattr -dr com.apple.quarantine /Applications/Escale.app',
    noteWin: 'L’application n’est pas encore signée : SmartScreen avertit au premier lancement, choisissez « Exécuter quand même ».',
    toutes: 'Toutes les versions'
  },
  pied: { suite: 'Les autres outils de Luth' }
};

export const en: Contenu = {
  meta: {
    title: 'Escale — the vertical tab browser',
    description:
      'Vertical tabs, folders, separate spaces and Chrome Web Store extensions, in a fast browser with no telemetry. Free, for macOS and Windows.'
  },
  nav: { fonctions: 'Features', securite: 'Security', telecharger: 'Download', langue: 'Language' },
  hero: {
    badge: 'Version {v} · macOS and Windows',
    titre: 'Your tabs, tidied to the side.',
    texte:
      'Escale lines your tabs up vertically, files them into folders and keeps the parts of your life apart in spaces, each with its own colour and its own sign-ins. Chrome extensions come along.',
    telecharger: 'Download',
    code: 'View the code'
  },
  demo: {
    label: 'A live demo of the Escale window',
    espaces: ESPACES_EN,
    aujourdhui: 'Today',
    astuce: 'Switch spaces at the bottom of the sidebar: the window takes on its colour.'
  },
  fonctions: {
    titre: 'What it does',
    items: [
      {
        titre: 'Vertical tabs',
        texte:
          'Titles read in full. Pinned at the top, today’s tabs below: the ones you stop opening close themselves after 12 hours, adjustable.'
      },
      { titre: 'Folders', texte: 'Nested, collapsible, coloured. Drop a tab in and it stays there between sessions.' },
      {
        titre: 'Spaces',
        texte:
          'Each space has its own session: its cookies, its sign-ins, its colour. Two Google accounts side by side, neither signing the other out. Swipe with two fingers to move between them.'
      },
      {
        titre: 'Chrome extensions',
        texte: 'Installed from the Chrome Web Store, package signature checked, permissions spelled out before you install.'
      },
      {
        titre: 'Command bar',
        texte: '⌘T or ⌘L: open tabs, pinned tabs, history, an address or a search, all in one place.'
      },
      {
        titre: 'Nothing abrupt, nothing slow',
        texte:
          'Every action ends in a short, interruptible motion: you see where a tab comes from and where it goes. With “reduce motion”, it all becomes a fade.'
      },
      {
        titre: 'Video on the side',
        texte:
          'On any site, a video pops out into a small window that stays on top of everything: seek, skip, set the volume, drag it, resize it.'
      },
      {
        titre: 'Made yours',
        texte:
          'Accent colour, space tint, framed or edge-to-edge page, sidebar width, and a photo for each space. Closed, the sidebar shrinks to its icons.'
      }
    ]
  },
  commande: {
    titre: 'One bar to find everything',
    texte:
      'Type a few letters: Escale looks through your open tabs, pinned tabs and history before going to the web. A prefix sends the search to the right place.',
    saisie: 'yt pottery',
    lignes: [
      { type: 'YouTube', texte: 'Search “pottery”' },
      { type: 'Open tab', texte: 'Pottery tutorial' },
      { type: 'History', texte: 'Pottery for beginners' }
    ],
    prefixes: [
      { cle: 'yt', texte: 'YouTube' },
      { cle: 'gh', texte: 'GitHub' },
      { cle: 'w', texte: 'Wikipedia' },
      { cle: 'g', texte: 'Google' }
    ]
  },
  chiffres: {
    titre: 'Measured, not promised',
    sous: 'Recorded on 22 October 2026 on an Apple Silicon MacBook, with the benchmark that ships in the repository.',
    items: [
      { valeur: '356 ms', texte: 'from launch to the sidebar on screen' },
      { valeur: '34 ms', texte: 'between ⌘T and the command bar' },
      { valeur: '0 KB/s', texte: 'of internal messages at rest, 10 tabs open' },
      { valeur: '6.9 ms', texte: 'per frame while scrolling 300 tabs' }
    ]
  },
  extensions: {
    titre: 'Extensions, without the spin',
    texte:
      'Escale implements part of the chrome.* APIs: most extensions work, not all of them. Escale warns you before installing one that relies on a missing API.',
    lignes: [
      { nom: 'Dark Reader', etat: 'Works' },
      { nom: 'Bitwarden', etat: 'Installs, popup works, autofill to be confirmed' },
      { nom: 'MV3 blockers (uBlock Origin Lite, AdGuard)', etat: 'Replaced by the built-in blocker' }
    ],
    note: 'Not available yet: declarativeNetRequest, identity, downloads, nativeMessaging.'
  },
  securite: {
    titre: 'Security first',
    texte: 'A browser opens the whole web onto your machine. So Escale starts fully closed and only opens what it must.',
    items: [
      {
        titre: 'Engine kept current',
        texte: 'Electron security fixes ship within 72 hours for a critical flaw, within two weeks for the rest.'
      },
      {
        titre: 'Sealed pages',
        texte: 'Sandbox and isolation everywhere, no Node access. Only the sidebar talks to the rest of the app, through a closed list of actions.'
      },
      {
        titre: 'HTTPS by default',
        texte: 'Addresses are upgraded to HTTPS (except on your local network), invalid certificates are refused, DNS is encrypted when possible.'
      },
      {
        titre: 'Permissions on request',
        texte: 'Camera, microphone, location, notifications and clipboard are asked site by site. USB, Bluetooth and serial ports are refused.'
      },
      {
        titre: 'Verified extensions',
        texte: 'CRX3 signatures checked at install and on every update, and no access to local files.'
      },
      {
        titre: 'Marked downloads',
        texte: 'Every file you receive is flagged as coming from the Internet, and executables are pointed out before you open them.'
      }
    ],
    reseau:
      'No telemetry. On its own, Escale only reaches GitHub for updates, search suggestions (which you can turn off) and the Chrome Web Store if you install an extension.'
  },
  telecharger: {
    titre: 'Download Escale',
    texte: 'Free. No account to create.',
    mac: 'macOS · Apple Silicon',
    win: 'Windows · x64',
    noteMac:
      'The app is not signed yet. On first launch, open Terminal and run: xattr -dr com.apple.quarantine /Applications/Escale.app',
    noteWin: 'The app is not signed yet: SmartScreen warns on first launch, choose “Run anyway”.',
    toutes: 'All releases'
  },
  pied: { suite: 'More tools by Luth' }
};
