# Escale — repères pour travailler sur ce dépôt

Navigateur Electron façon Arc, dans la famille visuelle de Hublink (`../hublink`, dont plusieurs modules sont repris). Code et commits **en français**. Spec : `docs/superpowers/specs/2026-10-22-escale-design.md`.

## Identité

Commits signés `Luth <57181738+Luth-infinity@users.noreply.github.com>`, **aucun** trailer d'attribution IA, aucune mention Posidea ni de nom réel.

## Architecture

- `src/main/model/arbre.js` : le modèle pur (espaces, dossiers, onglets). Toute opération renvoie `{ etat, deltas }` ; rien n'est émis quand rien ne change.
- `src/main/etat.js` : détient l'état, l'écrit (`store.js`), diffuse les deltas au shell et aux modules du principal.
- `src/main/onglets.js` : une `WebContentsView` par onglet vivant ; suit les deltas (`active:changed` → `afficher`).
- `src/main/actions.js` : la liste blanche des actions du shell, avec leurs schémas. Toute nouvelle action passe par `ipc.action` (expéditeur vérifié + schéma).
- Shell React (`src/renderer`) : reçoit un état initial puis des deltas (`etat.ts`). Le preload est **bundlé par Vite** (`vite.preload.mts`) : il embarque `<browser-action-list>`.

## Pièges

- **La vue web est native** : elle se peint au-dessus du HTML du shell. Modales → `useModalePage()` (image de la page + `layout.overlay`). Menus → natifs. Recherche dans la page → au-dessus de la page, qui descend.
- **electron-chrome-extensions rappelle `selectTab`** quand on l'informe nous-mêmes (`addTab` marque l'onglet ajouté comme actif) : tout appel à la lib passe par `enInterne()` dans `extensions.js`, sinon un onglet ouvert en arrière-plan vole le premier plan.
- **La vérification CRX** est branchée sur le `fetch` que `electron-chrome-web-store` capture à son chargement. À re-tester à chaque montée de version de la lib.
- **Un seul écouteur `webRequest` par session** : il est réservé au bloqueur. La montée en HTTPS passe par les événements de navigation.
- **Popups** : ne jamais passer `session` ni `partition` dans `overrideBrowserWindowOptions`.
- **Bancs de test** : lancer Electron avec `--disable-backgrounding-occluded-windows --disable-renderer-backgrounding`, sinon macOS juge la fenêtre masquée et Chromium gèle les animations. `pkill -9 -f "escale/node_modules/electron"` avant chaque lancement (verrou d'instance unique).
- Ne jamais lancer `vite build` pendant `npm run dev`.
- **Connexion Google : l'UA réel, jamais l'UA « Chrome ».** Sur `accounts.google.com`, un UA qui se dit Chrome sans l'empreinte de Chrome mène à « Ce navigateur ou cette application ne sont peut-être pas sécurisés » ; l'UA réel d'Electron (`Escale/x Electron/y`) passe (`ua.js`, `uaPour`). Vérifié avec une adresse factice : « Impossible de trouver ce compte » = le contrôle du navigateur est franchi.
- **Cadres d'extension** (menu d'un gestionnaire de mots de passe posé dans la page) : `nodeIntegrationInSubFrames` sur les vues, sinon le preload d'electron-chrome-extensions n'y tourne pas et la moitié de `chrome.*` manque.
- **YouTube** (`ambiance.js`) : ambiance, bulle et sponsors posés dans un monde isolé (1201), construits sans innerHTML (Trusted Types de YouTube). La bulle range ses demandes, le principal les relève toutes les 300 ms. « Ignorer » une pub : vrai clic (`sendInputEvent`), YouTube refuse les clics de script. **Contraste de l'ambiance** : la couleur du texte suit la luminosité MESURÉE du fond (page, sous le lecteur, colonne droite), jamais le thème ; YouTube colore son texte par des variables au nom haché (`--tffc…`) : la couleur est posée directement, sauf boutons à fond plein (mesuré : `data-escale-plein`, les classes ne le disent plus), miniatures et champs ; barre du haut, menus et tiroir gardent le thème.
- **yt-dlp** (`videos.js`) : moteur JavaScript = Deno téléchargé au premier usage, **jamais** Electron : le fusible RunAsNode reste fermé (spec §9.3).
- **Navigation privée** : un mode, pas un espace pour l'utilisateur. Derrière, espace `prive: true` caché du sélecteur et des menus, partition sans `persist:` vidée en sortant (`espace.prive` bascule) et purgé au démarrage (`etat.init`), rien dans l'historique, pas d'extensions.
- **Onglet actif pour les extensions** : Electron remplit `sender.tab` des scripts de contenu sans `active` ni `highlighted`. Dashlane n'analyse alors aucun champ : `extensions.surligner` émet `tabs.onHighlighted` (événement ajouté par `src/preload/webrequest-ext.js`, absent de la lib) à l'activation et après chaque chargement.
- **Plein écran vidéo** : `boite()` mesure l'écran, pas la fenêtre ; `zone()` ne repose pas la vue tant qu'elle est en plein écran.
- **Barre masquée** : la bande de 8 px du bord gauche la réveille ; le principal suit le pointeur (`barre.survol`), le shell ne le voit pas partir sur la page.
- **Popups d'extension sous Windows mis à l'échelle** : `ajusterPopup` (extensions.js) reprend taille et placement ; le reverrouillage « non redimensionnable » et `updatePosition` de la lib rognent la fenêtre.

## Publier une version

1. `npm version X.Y.Z --no-git-tag-version`, commit, tag `vX.Y.Z`, push de main et du tag.
2. `npm run dist:win -- --publish never` puis `npx electron-builder --mac --publish never` (sur un Mac : les deux se construisent ici).
3. `gh release create vX.Y.Z` avec `Escale-Setup-X.Y.Z-x64.exe`, son `.blockmap`, `latest.yml` (mise à jour auto Windows) et les deux `.dmg` ; l'action « Binaires macOS » les reconstruit ensuite.
4. **Chaque release porte un GIF léger de sa nouveauté principale** (comme Hublink), montré en haut de « Nouveautés » : motion design filaire sans texte dans `../escale-motion` (Remotion, `npm run gif <composition>`, 640 × 360, `scripts/gif.sh`), joint sous le nom `nouveaute.gif` et appelé en première ligne du corps : `![](https://github.com/Luth-infinity/escale/releases/download/vX.Y.Z/nouveaute.gif)`. `updates.js` l'écarte des puces et le passe au shell en data URL. Pas de GIF pour un pur correctif.
5. Site : `cd site && vercel deploy --prod` (lié à zawatsukas-projects/escale-luth) ; il lit lui-même la dernière release, seul son contenu est à tenir à jour.

## Outils de dev (hors app empaquetée)

`--apercu=<chemin>` (captures du shell et de la page), `--verif-mouvement=<chemin>` (pilote l'interface et relève l'état), `--perf-liste` (300 onglets), `--mesures`, `--test-securite`.
