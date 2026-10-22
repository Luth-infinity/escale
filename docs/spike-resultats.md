# Spike : résultats (22/10/2026)

Électron 41.10.6 (Chromium 146), `electron-chrome-extensions@4.9.0`, `electron-chrome-web-store@0.13.0`, macOS arm64. Banc : `spike/main.js`, résultats bruts dans `spike/resultats.json`.

## Extensions

| Extension | Installée | Popup | Effet réel | Verdict |
|---|---|---|---|---|
| Dark Reader 4.9.133 (MV3) | oui | oui, s'affiche | example.com passe en `rgb(24,26,27)`, feuille `style.darkreader` injectée | **marche** |
| Bitwarden 2026.10.0 (MV3) | oui | oui, écran d'accueil rendu | service worker démarré ; remplissage non testé (il faut un compte) | **marche jusqu'au popup**, remplissage à vérifier à la main |
| uBlock Origin Lite (MV3) | oui | oui, s'affiche | **ne bloque rien** : la requête vers doubleclick passe | **ne marche pas** |

Cause pour uBlock Origin Lite : `chrome.declarativeNetRequest` est **absent** (ni Electron ni la bibliothèque ne l'implémentent). Tous les bloqueurs MV3 en dépendent.

API présentes dans une page d'extension : `tabs`, `windows`, `contextMenus`, `cookies`, `notifications`, `downloads`, `permissions`, `offscreen`, `storage`, `alarms`, `scripting`, `webNavigation`, `action`, `runtime`. Absentes : **`declarativeNetRequest`** et **`identity`**.

Bruit sans conséquence : la directive CSP `navigate-to` est inconnue (Dark Reader), et `NOTREACHED Unexpected view type` apparaît sur `runtime.connect` (Bitwarden).

**Sécurité** : `electron-chrome-web-store` lit l'en-tête CRX3 mais **ne vérifie pas la signature** (le champ `signature` est parsé, aucun `crypto.verify`). Le `crx.verifier` de la tâche 5 est donc indispensable, et doit s'insérer avant l'installation.

## Animation des vues

| Mesure | Résultat | Cible |
|---|---|---|
| `capturePage()` + JPEG, page Wikipédia 1424×900 | médiane **6,8 ms**, p95 8,4 ms, max 191 ms (premier appel) | < 30 ms |
| `setBounds` piloté par `requestAnimationFrame` pendant 1 s | **137/137** frames reçues (écran 120 Hz), coût médian 0,1 ms | 60 fps |
| `view.setBorderRadius(10)` | appel accepté | rendu à contrôler visuellement |

`setBounds` à chaque frame tient largement : le repli de la barre et le split view peuvent suivre en continu, sans passer par une capture. Pour le changement d'onglet, la capture est assez rapide pour être prise au clic ; un cache reste utile pour le premier appel (191 ms).

Non vérifié ici : Windows, et le rendu visuel des coins arrondis (pas de droit d'enregistrement d'écran dans cette session).

## Verdict : GO

2 extensions sur 3 marchent (Dark Reader de bout en bout, Bitwarden jusqu'au popup), et la capture est bien sous les 30 ms. On garde `electron-chrome-extensions` + `electron-chrome-web-store`.

Conséquences sur la suite :
- **Bloqueurs de pub** : en attendant, le bloqueur intégré d'Escale (`adblock.js`) remplace uBlock. On ajoute au lot 2 un **pont `declarativeNetRequest`** : lire les `rule_resources` statiques des extensions et appliquer les règles `block` / `upgradeScheme` / `redirect` via `session.webRequest`. C'est la seule voie pour faire marcher uBlock Origin Lite, AdGuard, etc.
- **`identity`** : reste au lot 2, comme prévu.
- **Tâche 5** : vérifier la signature CRX3 nous-mêmes, avant `installExtension`.
