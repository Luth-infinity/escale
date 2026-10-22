# Escale

Un navigateur à onglets verticaux, dossiers et espaces, avec les extensions du Chrome Web Store. Un outil de Luth.

- **Onglets verticaux** : épinglés en haut, onglets du jour en dessous, fermés d'eux-mêmes après 12 h d'inactivité (réglable).
- **Dossiers** : imbriqués, repliables, colorés ; on y glisse ses onglets.
- **Espaces** : chacun a sa propre session (cookies, connexions). On passe de l'un à l'autre au trackpad, à deux doigts.
- **Extensions Chrome** : installées depuis le Chrome Web Store, signature du paquet vérifiée.
- **Barre de commande** (⌘T / ⌘L) : onglets ouverts, épinglés, historique, adresse ou recherche (`yt …`, `gh …`, `w …`, `g …`).

## Développer

```bash
npm install
npm run dev
```

| Commande | Rôle |
|---|---|
| `npm test` | Tests unitaires (modèle, persistance, IPC, CRX, barre de commande…) |
| `node scripts/test-securite.js` | Banc de sécurité dans l'app réelle (IPC, certificats, popups, permissions…) |
| `node scripts/mesures.js` | Cibles de performance de la spec (§5) |
| `npm run dist:mac` / `npm run dist:win` | Installeurs `.dmg` / `.exe` |

## Performances mesurées (22/10/2026, MacBook Apple Silicon)

| Mesure | Résultat | Cible |
|---|---|---|
| Barre latérale à l'écran, depuis le démarrage d'Electron | 356 ms | < 500 ms |
| ⌘T → première image de la barre de commande | 34 ms | < 100 ms |
| Messages internes au repos, 10 onglets | 0 Ko/s | < 2 Ko/s |
| Mémoire, 30 onglets dont 5 vivants | 877 Mo | < 1 Go |
| Défilement de la liste, 300 onglets | 6,9 ms par image (max 9,6) | 60 i/s |

## Extensions : ce qui marche

Escale s'appuie sur [`electron-chrome-extensions`](https://github.com/samuelmaddock/electron-browser-shell) et `electron-chrome-web-store`. Electron ne réimplémente qu'une partie des API `chrome.*` : la plupart des extensions marchent, pas toutes.

| Extension | État |
|---|---|
| Dark Reader | Fonctionne |
| Bitwarden | S'installe, popup fonctionnel ; remplissage à confirmer |
| uBlock Origin Lite, AdGuard et autres bloqueurs MV3 | Ne bloquent rien : `declarativeNetRequest` manque. Le bloqueur intégré d'Escale les remplace en attendant. |

API absentes aujourd'hui : `declarativeNetRequest`, `identity`, `downloads`, `tabs.captureVisibleTab`, `nativeMessaging` (extensions qui parlent à une app installée, comme 1Password de bureau), `desktopCapture`. Escale prévient avant l'installation d'une extension qui en dépend.

## Ce qu'il ne fait pas (encore)

- Pas de synchronisation entre appareils.
- Pas de gestionnaire de mots de passe intégré : utilisez une extension (Bitwarden).
- Pas de signature de code : sur macOS, retirer la quarantaine au premier lancement (`xattr -dr com.apple.quarantine /Applications/Escale.app`) ; sous Windows, SmartScreen avertit au premier lancement.
- Conséquence de la signature ad hoc sur macOS : les cookies sont chiffrés avec une clé du trousseau, et chaque nouvelle version a une signature différente. Au premier lancement après une mise à jour, macOS demande l'accès à « Escale Safe Storage » : répondre **Toujours autoriser**. L'app attend la réponse avant de s'ouvrir.
