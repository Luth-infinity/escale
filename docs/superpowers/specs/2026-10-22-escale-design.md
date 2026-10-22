# Escale — spec de conception

Date : 22/10/2026 · Statut : à relire

## 1. Intention

Un navigateur de bureau façon Arc, dans la famille visuelle de Hublink, signé Luth.

Ce qu'a demandé l'utilisateur :
- **Onglets verticaux, dossiers, extensions Chrome** : les trois priorités.
- Le **maximum d'extensions** compatibles.
- **Fluide, sans lag**, avec des animations ultra fluides partout.
- **La sécurité comme priorité absolue** (§9).
- La DA de Hublink **plus un détail qui les différencie**. Les trois pistes sont retenues : page encadrée, accent propre, teinte par dossier.
- **Tout ce qu'on attend d'un bon navigateur** (§6).
- Un **site dédié**, et une entrée sur le hub Luth.

Hypothèses (à corriger si fausses) :
- App gratuite et open source, sur un dépôt public `Luth-infinity/escale`.
- macOS (arm64) et Windows (x64), comme Hublink.

Critères de réussite :
- Les 3 features prioritaires marchent de bout en bout.
- Les extensions courantes fonctionnent : uBlock Origin Lite, Bitwarden, Dark Reader, Grammarly, React DevTools, Google Traduction, une extension de capture.
- Les cibles de performance du §5 sont tenues et **mesurées**.

## 2. Découpage du projet

1. **Escale, le navigateur** : cette spec.
2. **Le site dédié** : spec séparée, rédigée une fois l'app capturable. Next.js + Tailwind v4 dans `site/`, sur le modèle du site de Hublink. Mêmes contraintes : copie concrète, chiffres mesurés, une section « Ce qu'il ne fait pas », pied de page « un outil de Luth » sans lien.
3. **L'entrée sur le hub Luth** (`Apps/luth-site`) : une fiche, puis `vercel deploy --prod` **et** `vercel alias set … luth-apps.vercel.app`.

## 3. Socle technique

**Stack** : celle de Hublink. Electron 41, React 19, Tailwind v4, shadcn, Vite et electron-builder (.dmg + .exe, `toolsets.nsis: "1.2.1"`). `dependencies` reste minimal, le renderer est bundlé par Vite.

**Dépôt neuf**, alimenté par des copies de modules éprouvés de Hublink plutôt que par un fork. Hublink porte une logique de services et de comptes qui n'a rien à faire ici.

| Repris de Hublink (`src/main/`) | Usage dans Escale |
|---|---|
| `views.js` | Gestion des `WebContentsView`, avec le compteur `demande` contre la course au clic |
| `ua.js` | User-agent sans `Electron/x` |
| `unzip.js` | Décompression des CRX2/CRX3 |
| `capture.js` | Capture pleine page par CDP |
| `adblock.js` | Bloqueur intégré (liste de domaines) |
| `downloads.js` | Téléchargements |
| `suggestions.js` | Suggestions de la barre de commande |
| `menucontextuel.js` | Menu contextuel natif |
| `i18n.js` + `en.json` | Bilingue FR/EN (clé = texte français) |
| `updates.js` | Mises à jour de l'app |
| `favicon.js`, `urls.js` | Favicons via `session.fetch`, filtre `isUsableFavicon` |
| `index.css` | Tokens `--shell-*`, mécanique de teinte (`--tint-surface`, `adaptSpaceHue`) |

**Process** :
- **Principal** : il possède **tout l'état** (espaces, dossiers, onglets, historique) et toutes les vues. Il les crée, les met en veille et les positionne.
- **Shell React** : il n'affiche que la barre latérale, la barre du haut, la barre de commande, les réglages et les panneaux. Il reçoit des **événements delta** (`tab:added`, `tab:meta`, `tab:moved`…), jamais l'état complet, sauf une fois au démarrage.
- **Une `WebContentsView` par onglet vivant** : elle est détruite quand l'onglet est mis en veille, l'onglet restant dans la liste.

**Persistance** :
- `escale.json` : espaces, dossiers, onglets épinglés et réglages. Écriture avec un debounce de 1 s, atomique (fichier temporaire puis `rename`).
- `history.sqlite` : historique et visites, via `node:sqlite`, sans dépendance. Index plein texte (FTS5) sur titre et URL.
- Session restaurée au lancement : les onglets non épinglés sont enregistrés dans `escale.json` avec leur URL. Ils reviennent **en veille**, et aucune page ne se charge avant d'être cliquée.

## 4. Modèle de données

```
Espace   { id, nom, icône, teinte, partition }      // partition figée à la création
Dossier  { id, espaceId, parentId|null, nom, teinte|null, replié }
Onglet   { id, espaceId, dossierId|null, épinglé, url, titre, favicon, ordre,
           dernièreActivité, muet, zoom }
```

- **Espace = session Chromium isolée** (`persist:space-<id>`). Le perso et le boulot ne partagent jamais leurs cookies. Leçon de Hublink : la partition est **figée** à la création, jamais dérivée d'un nom.
- **Épinglé** = favori persistant : il survit à la fermeture automatique et garde son URL d'origine (« revenir à l'URL épinglée »).
- **Non épinglé** = onglet du jour, en dessous d'un séparateur. Fermeture automatique au bout de N heures d'inactivité (12 h par défaut, réglable, désactivable).
- **Dossiers imbriqués** : ils ne contiennent que des onglets épinglés, comme dans Arc. Profondeur illimitée côté données, indentation limitée à 3 niveaux visuels.
- Un ordre explicite (`ordre`, en indices fractionnaires) permet de déplacer un élément sans réécrire toute la liste.

## 5. Performance

Ces cibles sont mesurées avec le harnais de Hublink (`webContents.send` instrumenté, `app.getAppMetrics()`) :

| Cible | Valeur |
|---|---|
| Fenêtre affichée au lancement | < 500 ms, la barre latérale avant toute page |
| Ouverture d'un onglet (Cmd+T → barre prête) | < 100 ms |
| Changement d'onglet vivant | < 16 ms côté shell |
| Scroll de la liste, 300 onglets | 60 fps |
| IPC au repos, 10 onglets ouverts | < 2 Ko/s |
| Mémoire, 30 onglets dont 5 vivants | < 1 Go |

Leviers :
- Deltas uniquement. Un événement n'est émis **que si la valeur change** (`updateIfChanged`). `page-title-updated` et les favicons sont regroupés dans une fenêtre de 250 ms.
- **Mise en veille** : une vue inactive depuis plus de 20 min (réglable) est détruite. Jamais l'onglet visible, ni un onglet qui joue du son ou de la vidéo.
- **Liste virtualisée** (rendu des seules lignes visibles), `React.memo` par ligne, handlers stables.
- `setBounds` dédupliqué, et géométrie envoyée une seule fois par frame.
- Aucune requête synchrone au démarrage. Les extensions se chargent **en parallèle** de l'affichage, et le compteur `demande` empêche une réponse lente d'écraser un clic récent.
- Pièges connus : une vue native se peint au-dessus du HTML, donc les modales cachent la vue (`setOverlay`) et les menus passent par `Menu.popup()` natif.

## 6. Fonctionnalités

Les lots sont livrés dans cet ordre. Le lot 1 contient les trois priorités.

### Lot 1 : le cœur
- **Onglets verticaux** : épinglés / non épinglés, glisser-déposer, fermer, dupliquer, muet, indicateur de son.
- **Dossiers** : création, imbrication, repli, renommage, teinte, glisser un onglet dedans.
- **Espaces** : création, bascule (Ctrl+1…9 et balayage du trackpad), icône, teinte.
- **Extensions** : voir §7.
- Navigation : précédent / suivant / recharger, gestes du trackpad, barre d'adresse dans la barre latérale.
- Barre de commande (Cmd+T / Cmd+L) : onglets ouverts, historique, épinglés, suggestions web.
- Restaurer un onglet fermé (Cmd+Shift+T), restauration de session.
- Rechercher dans la page (Cmd+F), zoom par site.
- Barre latérale repliable : rail d'icônes, comme dans Hublink.

### Lot 2 : un vrai navigateur
- Historique (panneau + recherche FTS), suppression par période.
- Téléchargements : panneau, pause/reprise, ouvrir le dossier.
- Moteur de recherche au choix, raccourcis de recherche (`yt …`, `gh …`).
- Navigation privée : fenêtre à partition **non persistante**.
- Permissions par site (caméra, micro, localisation, notifications, presse-papiers) et panneau « Ce site ».
- Données par site : cookies, stockage, « effacer les données de ce site ».
- Bloqueur de pubs et traqueurs intégré (`adblock.js`), désactivable par site.
- HTTPS forcé, avec avertissement avant de charger en HTTP.
- Imprimer, enregistrer la page, lecteur PDF (celui de Chromium, présent dans Electron).
- Notifications des sites, pastille du Dock / overlay Windows.

### Lot 3 : le confort Arc
- Split view (2 à 4 vues côte à côte, glisser un onglet sur un bord).
- Mini-fenêtre pour les liens ouverts depuis d'autres apps (Escale en navigateur par défaut).
- Picture-in-picture automatique quand on quitte un onglet vidéo.
- Détection des onglets en double.
- Mode lecture.
- Capture de page (zone visible, pleine page), via `capture.js`.
- Import depuis Chrome, Arc, Safari et Firefox : favoris et historique. Les mots de passe sont exclus (§9).
- Raccourcis clavier personnalisables.
- Outils de développement (DevTools, Cmd+Opt+I).
- Navigateur par défaut du système.

### Transverse, dès le lot 1
- Thème clair / sombre / système, bilingue FR/EN, mises à jour automatiques, écran « Nouveautés ».

### Hors périmètre
- Synchronisation entre appareils : il faudrait un serveur et des comptes.
- Version mobile.
- Assistant IA intégré.
- Gestionnaire de mots de passe maison : on passe par les extensions (Bitwarden) et par le trousseau système pour les passkeys.

## 7. Extensions : le maximum possible

**Base** : `electron-chrome-extensions` (implémente `tabs`, `windows`, `contextMenus`, `cookies`, `notifications`, `action`/`browserAction`, `webNavigation`…) et `electron-chrome-web-store` (installation et **mises à jour automatiques** depuis le Chrome Web Store).

**Compléments maison**, branchés par l'API d'extension de la bibliothèque, ou par un preload de service worker (`session.registerPreloadScript({type:'service-worker'})`) quand elle n'en a pas :

| API | Approche |
|---|---|
| `downloads` | Pont vers `downloads.js` (`will-download` d'Electron) |
| `permissions` | `contains` / `request` répondent selon le manifest, avec une confirmation utilisateur pour les permissions optionnelles |
| `identity.launchWebAuthFlow` | Fenêtre d'auth dans la session de l'espace, interception de la redirection `*.chromiumapp.org` |
| `tabs.captureVisibleTab` | `webContents.capturePage()` sur la vue active |
| `storage.sync` | Alias de `storage.local`, sans synchronisation |
| `offscreen` | Document caché (`WebContentsView` hors écran) |

**Impossible sans forker Chromium**, à documenter dans l'app et sur le site :
- le native messaging (`connectNative`), donc les extensions qui parlent à une app installée (1Password desktop) ;
- `desktopCapture` en tant que tel ;
- les API d'entreprise ou de ChromeOS.

**Matrice de compatibilité** : on teste une liste d'extensions de référence à chaque montée de version. Le résultat est publié dans le README et sur le site. À l'installation, chaque extension est comparée à cette matrice et à ses permissions déclarées, et l'utilisateur est prévenu si une API manque (comportement déjà présent dans Hublink).

**Risques** :
- La dernière version de la bibliothèque date de **juillet 2025**. Sa compatibilité avec Electron 41 n'est **pas vérifiée**. C'est la **première tâche du plan** : un spike d'une demi-journée qui charge uBlock Origin Lite, Bitwarden et Dark Reader. Si ça casse, on corrige dans un fork local ou on implémente les API nous-mêmes. Le spike chiffre ce coût.
- **Licence** : la bibliothèque est en **GPL‑3** (ou licence payante « patron »). Escale sera donc publié en **GPL‑3**, et non en MIT comme Hublink. C'est sans conséquence pour une app gratuite et open source.

## 8. Direction artistique

On garde de Hublink : les tokens `--shell-*` (gris bleutés, teinte 265), la typographie, les rayons, la barre du haut pleine largeur avec `trafficLightPosition {x:16,y:16}`, et les règles de contraste (≥ 7:1 en sombre, jamais `opacity` sur du texte `muted`).

Les trois signatures d'Escale :
1. **Page encadrée** : la vue web est inset de 8 px avec 10 px de rayon, sur le fond du shell. Ombre très douce en clair (une seule couche, 1 px de bordure `--shell-border`), aucune ombre en sombre. Les coins arrondis d'une `WebContentsView` passent par `view.setBorderRadius()` (Electron ≥ 34).
2. **Accent propre** : un vert d'eau profond, autour de `oklch(0.56 0.10 190)` en clair et `oklch(0.72 0.10 190)` en sombre. Il est réservé à l'onglet actif, au focus, aux contrôles cochés et au logo. Il est à valider visuellement, avec un contraste d'au moins 4,5:1 sur le texte qu'il porte.
3. **Teinte par dossier ou espace** : on reprend la mécanique de Hublink (`surface` et `line` dérivées, `adaptSpaceHue`), avec les mêmes dosages **très légers** et jamais d'aplat. C'est l'espace qui teinte la barre latérale ; un dossier ne teinte que son propre en-tête et sa ligne de rappel.

Garde-fous anti « vibe coded » : pas de glassmorphism, pas de dégradé, pas de `border-left` coloré arrondi.

### Mouvement : un outil premium, rien d'instantané

Demande explicite : **tout est animé, de façon ultra fluide**. Aucun changement d'état ne « saute » au clic. L'animation sert la continuité : on voit d'où vient un élément et où il va. Ce n'est jamais un effet décoratif (pas de rebond gratuit, pas de pulsation, pas de parallaxe).

Règles :
- **Ressorts plutôt que courbes fixes** : physique de ressort critique, sans rebond visible. Une animation est **interruptible** : recliquer en cours de route repart de la position courante, sans saut ni file d'attente.
- **Retour immédiat, mouvement court** : l'état pressé s'affiche à la première frame, puis le mouvement dure 150 à 250 ms. Le premium vient de la fluidité, pas de la lenteur. Les cibles de latence du §5 restent valables.
- **GPU seulement** : uniquement `transform` et `opacity`, jamais `width`, `height`, `top` ni `margin`. Hauteurs de dossier en FLIP (mesure, puis `transform`).
- **Moteur** : `motion` (ex-Framer Motion) pour les ressorts, `layout` et `AnimatePresence`. La liste virtualisée garde ses animations par ligne.
- `prefers-reduced-motion` : les mouvements deviennent des fondus de 100 ms, jamais des sauts.

Inventaire, chaque élément animé :

| Élément | Animation |
|---|---|
| Ouvrir / fermer un onglet | La ligne naît en hauteur + fondu ; les voisines glissent (layout) |
| Glisser-déposer | L'élément suit le pointeur avec une légère inertie, les autres s'écartent, puis il atterrit en ressort |
| Dossier | Repli / dépli en FLIP, chevron en rotation, enfants en cascade (20 ms d'écart, 5 max) |
| Onglet actif | Le fond de sélection **glisse** d'une ligne à l'autre (élément partagé `layoutId`) |
| Changement d'espace | La liste coulisse latéralement, suivant le doigt sur le trackpad ; la teinte du panneau passe en fondu |
| Barre de commande | Échelle 0,98 → 1 + fondu ; résultats qui se réordonnent en layout |
| Panneaux (historique, téléchargements, réglages) | Glissement depuis leur bord + fondu |
| Repli de la barre latérale | Largeur animée vers le rail d'icônes ; la page encadrée suit en continu |
| Split view | Les vues se redimensionnent en continu à la séparation et à la fermeture |
| Menus, survols, focus | Fondu de 80 à 120 ms ; anneau de focus qui apparaît sans saut |
| Téléchargement, chargement | Progression continue, jamais par paliers |

**Contrainte technique, la page web elle-même.** Une `WebContentsView` est une surface native : le CSS ne peut pas l'animer. Les parades, à valider dans le spike :
- **Changer d'onglet** : capturer la vue sortante (`capturePage()`, quelques ms), poser l'image dans le shell, masquer la vue, faire le fondu ou le glissement en HTML, puis révéler la vue entrante. On garde une capture récente par onglet vivant pour qu'il n'y ait aucune attente au clic.
- **Redimensionner** (repli de la barre, split view) : `setBounds` à chaque frame (`requestAnimationFrame` côté shell, géométrie envoyée au principal) **si** la mesure tient 60 fps. Sinon, même technique de capture que ci-dessus.
- **Objectif** : aucune frame blanche ni saut visible. Ce point est mesuré au spike, avec un enregistrement à 120 fps comparé image par image.

## 9. Sécurité : priorité de premier rang

Un navigateur est la porte d'entrée de tout : comptes, banque, mots de passe. La sécurité passe **avant** les fonctionnalités et avant le mouvement : en cas de conflit, elle gagne. Rien dans ce chapitre n'est optionnel.

### 9.1 Modèle de menaces

| Menace | Exemple |
|---|---|
| Page web malveillante | Exploit du moteur, phishing, téléchargement piégé, usurpation de l'URL |
| Extension malveillante ou compromise | Vol de cookies, injection de scripts, mise à jour piégée |
| Évasion vers l'app | Une page ou une extension qui atteint le shell, l'IPC ou Node |
| Attaque réseau | Wi‑Fi public, certificat invalide, rétrogradation en HTTP, DNS falsifié |
| Accès local | Quelqu'un lit le profil sur le disque (cookies, historique) |
| Chaîne de livraison | Fausse mise à jour, dépendance npm compromise |

### 9.2 Le moteur : rester à jour, c'est la première défense

Le risque n°1 d'un navigateur Electron, c'est un **Chromium en retard** : chaque version de Chrome corrige des failles activement exploitées.
- On suit **chaque version de sécurité d'Electron sous 72 h**, pour les failles critiques ou exploitées, et sous 2 semaines pour les autres. Ce délai est écrit dans `SECURITY.md`.
- Montée de version majeure d'Electron à chaque sortie, la branche stable suivie de près.
- Mises à jour automatiques de l'app, activées par défaut, avec un bandeau insistant si l'utilisateur les repousse.
- Alerte de veille : un abonnement aux annonces de sécurité d'Electron et de Chrome, et une issue ouverte automatiquement à chaque nouvelle version.

### 9.3 Isolation des process

- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` **partout** : shell, onglets, popups, extensions.
- Site isolation et process-per-site de Chromium laissés actifs, jamais désactivés par un drapeau.
- **Fuses Electron** (`@electron/fuses`), verrouillés au build : `RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off, `EnableNodeCliInspectArguments` off, `EnableEmbeddedAsarIntegrityValidation` on, `OnlyLoadAppFromAsar` on, `EnableCookieEncryption` on.
- Le shell est chargé depuis l'asar, **jamais** depuis le réseau. CSP stricte : `default-src 'self'`, pas de `unsafe-eval`, pas de script distant.

### 9.4 IPC : le shell est la seule porte, et elle est gardée

- Chaque `ipcMain.handle` **vérifie l'expéditeur** (`event.senderFrame` = le shell, origine attendue) et rejette tout le reste. Une page web ou une extension ne peut jamais appeler l'IPC du shell.
- Chaque message est **validé par un schéma** (types, longueurs, énumérations) avant usage. Les URL sont parsées, avec le protocole et le `hostname` comparés, jamais par `includes`.
- Le preload n'expose qu'une API minimale et nommée via `contextBridge`. Jamais `ipcRenderer` brut.

### 9.5 Navigation et contenu web

- **HTTPS par défaut** : passage automatique en HTTPS, page d'avertissement avant tout chargement en HTTP, HSTS de Chromium conservé.
- **Erreurs de certificat** : page d'interstitiel, **jamais** d'acceptation automatique (`certificate-error` refuse par défaut). Une exception n'est possible que par un clic explicite, pour la session seulement.
- **Navigation sécurisée** : on vérifie les URL contre les listes Google Safe Browsing (API v5, préfixes de hachage stockés en local, l'URL complète ne sort jamais). Page d'alerte pour l'hameçonnage, les logiciels malveillants et les téléchargements dangereux.
- **DNS sécurisé** (DNS over HTTPS) via `app.configureHostResolver`, en mode automatique par défaut.
- **Anti-usurpation de l'URL** : domaine enregistrable mis en évidence, IDN affichés en punycode quand ils mélangent les écritures (homographes), avertissement à l'entrée en plein écran, aucune page ne peut dessiner par-dessus la barre latérale.
- Popups bloquées sans geste utilisateur. Schémas externes (`mailto:`, `zoommtg:`…) sur confirmation, jamais `ms-msdt:` ni `file:` depuis une page web.
- Cookies tiers bloqués par défaut, bloqueur de traqueurs actif.

### 9.6 Permissions des sites : refus par défaut

- Caméra, micro, partage d'écran, localisation, notifications, presse-papiers, MIDI : **demande par origine**, avec une réponse mémorisée et révocable dans le panneau « Ce site ».
- Les API d'accès matériel (USB, HID, série, Bluetooth) et l'accès au système de fichiers sont **refusés** au lot 1 (`select-*-device` → aucun périphérique), puis ouverts au cas par cas avec un sélecteur explicite.
- `setPermissionCheckHandler` et `setPermissionRequestHandler` posés sur **chaque** session, y compris privée, avec un refus par défaut pour toute permission inconnue.

### 9.7 Extensions

- Installation **uniquement** depuis le Chrome Web Store. Le paquet téléchargé est **vérifié** : signature CRX3 du Web Store contrôlée avant décompression. Le dézippeur de Hublink ne le fait pas : c'est à ajouter, ou à confirmer côté `electron-chrome-web-store`. Aucun chargement de dossier local hors mode développeur.
- `loadExtension` **sans** `allowFileAccess`.
- **Écran de permissions** à l'installation, en clair (« peut lire et modifier toutes vos données sur tous les sites »), et une nouvelle confirmation si une mise à jour demande plus de droits.
- Accès aux sites réglable par extension : sur tous les sites, sur certains sites, ou au clic.
- Désactivées en navigation privée, sauf autorisation explicite par extension.
- Une extension n'a **aucun** accès au shell ni à l'IPC d'Escale.

### 9.8 Téléchargements

- Fichiers marqués comme venant d'Internet : `com.apple.quarantine` sur macOS et Mark-of-the-Web (`Zone.Identifier`) sur Windows, pour que Gatekeeper et SmartScreen fassent leur travail.
- Avertissement sur les types dangereux (`.exe`, `.dmg`, `.pkg`, `.app`, `.scr`, `.js`, `.command`…) et vérification Safe Browsing du fichier.
- Jamais d'ouverture automatique après téléchargement.

### 9.9 Données locales

- Cookies chiffrés (fuse `EnableCookieEncryption`, clé dans le trousseau macOS / DPAPI Windows).
- `escale.json` et `history.sqlite` en `0600`. Les secrets (jetons, clé de l'API Safe Browsing) passent par `safeStorage`.
- **Navigation privée** : partition non persistante, effacée à la fermeture, sans historique, sans écriture disque de notre fait.
- « Effacer les données de navigation » : par période et par type, vraiment effacées (`clearStorageData` + `clearCache` + suppression SQLite + `VACUUM`).
- **Aucune télémétrie**. Les seuls appels réseau d'Escale lui-même : mises à jour, listes Safe Browsing, suggestions de recherche (désactivables). Tous sont listés dans `SECURITY.md`.

### 9.10 Livraison et chaîne d'approvisionnement

- **Signature du code et notarisation** : Apple Developer ID + notarisation sur macOS, signature Authenticode sur Windows. Pour un navigateur, ce n'est pas négociable : sans signature, les mises à jour automatiques macOS ne fonctionnent pas et l'utilisateur apprend à contourner Gatekeeper. **Coût** : 99 $/an chez Apple, et un certificat Windows (≈ 200 à 400 €/an, ou Azure Trusted Signing ≈ 10 $/mois). **Décision à prendre par l'utilisateur.**
- Mises à jour par HTTPS avec vérification d'intégrité (sha512 + signature du paquet).
- Dépendances : versions figées (`package-lock.json`), `npm audit` et Dependabot sur le dépôt, revue de chaque nouvelle dépendance. Le moins de dépendances possible.
- Build reproductible en CI (GitHub Actions), artefacts publiés depuis la CI et non depuis un poste local.

### 9.11 Contrôle continu

- **Audit à chaque release** : `npm audit`, Electronegativity (scanner de configuration Electron), revue de la checklist officielle de sécurité Electron, revue manuelle de chaque nouvel `ipcMain.handle`.
- Tests automatisés de sécurité : IPC refusé depuis une page web, popup qui ne sort pas de sa partition, certificat invalide refusé, `file://` inaccessible à une extension, permission inconnue refusée.
- `SECURITY.md` : comment signaler une faille, délais de réponse, délais de mise à jour d'Electron.
- Leçons de Hublink conservées : les popups héritent de la session de l'ouvreur (ne jamais passer `session` ni `partition` dans `overrideBrowserWindowOptions`), `openExternal` filtré par protocole parsé, `will-navigate` et `setWindowOpenHandler` du shell qui refusent tout.

## 10. Tests et vérification

- Tests unitaires `node:test` sur la logique pure : modèle d'arbre (déplacer, imbriquer, fractions d'ordre), fermeture automatique, migration de `escale.json`, routage de la barre de commande.
- Un script de mesure (§5) relancé avant chaque release, avec les résultats consignés dans le README.
- La matrice d'extensions (§7), testée à la main avant chaque release.
- Avant chaque test : `pkill` des instances Electron (le verrou d'instance unique de Hublink fait quitter les suivantes en silence).

## 11. Identité du dépôt

- Dépôt `Luth-infinity/escale`. Commits signés `Luth <57181738+Luth-infinity@users.noreply.github.com>`, **sans** trailer d'attribution IA, sans mention Posidea et sans nom réel.
- `appId: com.luthinfinity.escale`, `Copyright (c) 2026 Luth`, licence GPL‑3.0.
- Homonyme existant : `kndpt/escale-browser` (navigateur WebKit, petit projet). Le nom est conservé, à la demande de l'utilisateur.
