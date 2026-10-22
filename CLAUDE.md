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
- **YouTube** (`ambiance.js`) : ambiance, bulle et sponsors posés dans un monde isolé (1201), construits sans innerHTML (Trusted Types de YouTube). La bulle range ses demandes, le principal les relève toutes les 300 ms. « Ignorer » une pub : vrai clic (`sendInputEvent`), YouTube refuse les clics de script.
- **yt-dlp** (`videos.js`) : moteur JavaScript = Deno téléchargé au premier usage, **jamais** Electron : le fusible RunAsNode reste fermé (spec §9.3).
- **Navigation privée** : espace `prive: true`, partition sans `persist:`, purgé au démarrage (`etat.init`), rien dans l'historique, pas d'extensions.
- **Plein écran vidéo** : `boite()` mesure l'écran, pas la fenêtre ; `zone()` ne repose pas la vue tant qu'elle est en plein écran.
- **Barre masquée** : la bande de 8 px du bord gauche la réveille ; le principal suit le pointeur (`barre.survol`), le shell ne le voit pas partir sur la page.
- **Popups d'extension sous Windows mis à l'échelle** : `ajusterPopup` (extensions.js) reprend taille et placement ; le reverrouillage « non redimensionnable » et `updatePosition` de la lib rognent la fenêtre.

## Outils de dev (hors app empaquetée)

`--apercu=<chemin>` (captures du shell et de la page), `--verif-mouvement=<chemin>` (pilote l'interface et relève l'état), `--perf-liste` (300 onglets), `--mesures`, `--test-securite`.
