# Sécurité

## Signaler une faille

Ouvrez un avis de sécurité privé sur GitHub (onglet *Security* → *Report a vulnerability*). Réponse sous 72 h.

## Le moteur reste à jour

Escale embarque Chromium par Electron. Chaque version de sécurité d'Electron est intégrée :
- **sous 72 h** pour une faille critique ou exploitée ;
- **sous 2 semaines** pour les autres.

## Ce qu'Escale envoie sur le réseau, de lui-même

| Destination | Pourquoi | Désactivable |
|---|---|---|
| `api.github.com` (releases d'Escale) | Signaler une nouvelle version | Non |
| `suggestqueries.google.com` | Suggestions de la barre de commande (jamais une adresse) | Oui, dans les réglages |
| `clients2.google.com` / Chrome Web Store | Installer et mettre à jour les extensions | Oui (ne pas installer d'extension) |

Aucune télémétrie.

## Défenses en place

- `sandbox`, `contextIsolation`, pas de `nodeIntegration`, partout.
- Fuses verrouillés au build : pas de `RunAsNode`, pas de `NODE_OPTIONS`, pas d'`--inspect`, intégrité de l'asar vérifiée, cookies chiffrés.
- Le shell est la seule page qui parle au process principal : expéditeur vérifié, puis message validé par schéma ; une liste blanche d'actions.
- HTTPS d'office (sauf réseau local), certificats invalides refusés, DNS sécurisé en mode automatique.
- Permissions des sites refusées par défaut ; caméra, micro, position, notifications et presse-papiers sur confirmation par origine ; USB, HID, série et Bluetooth refusés.
- Schémas dangereux (`file:`, `ms-msdt:`, `search-ms:`…) bloqués depuis une page ; les autres applications externes sur confirmation.
- Paquets d'extension : signature CRX3 vérifiée (développeur **et** Chrome Web Store) à l'installation comme aux mises à jour ; permissions expliquées en clair avant d'installer ; pas d'accès aux `file://`.
- Téléchargements marqués « venant d'Internet » (quarantaine macOS, Mark-of-the-Web Windows), avertissement sur les types exécutables.

## Avant chaque release

1. `npm audit`
2. `npx @doyensec/electronegativity -i .`
3. [Checklist de sécurité d'Electron](https://www.electronjs.org/docs/latest/tutorial/security), point par point
4. Relire chaque `ipc.handle` / `ipc.action` ajouté depuis la dernière version
5. `node scripts/test-securite.js`
