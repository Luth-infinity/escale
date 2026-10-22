import test from 'node:test';
import assert from 'node:assert';
import { cibleDepot, sansElement } from './depot.ts';
import type { Ligne } from './aplatir.ts';
import type { Etat } from '../types.ts';

// Épinglés : p1, dossier D (déplié) contenant d1, puis séparateur, puis j1, j2.
const lignes: Ligne[] = [
  { type: 'onglet', id: 'p1', profondeur: 0 },
  { type: 'dossier', id: 'D', profondeur: 0 },
  { type: 'onglet', id: 'd1', profondeur: 1 },
  { type: 'separateur', id: 'jour', profondeur: 0 },
  { type: 'onglet', id: 'j1', profondeur: 0 },
  { type: 'onglet', id: 'j2', profondeur: 0 }
];
const etat = {
  dossiers: [{ id: 'D', parentId: null }],
  onglets: [
    { id: 'p1', dossierId: null, epingle: true },
    { id: 'd1', dossierId: 'D', epingle: true },
    { id: 'j1', dossierId: null, epingle: false },
    { id: 'j2', dossierId: null, epingle: false }
  ]
} as unknown as Etat;

test('sansElement retire l’élément et, pour un dossier, tout son contenu', () => {
  assert.deepStrictEqual(sansElement(lignes, 'j1').map((l) => l.id), ['p1', 'D', 'd1', 'jour', 'j2']);
  assert.deepStrictEqual(sansElement(lignes, 'D').map((l) => l.id), ['p1', 'jour', 'j1', 'j2']);
});

test('sous le séparateur : zone du jour, entre deux onglets', () => {
  const l = sansElement(lignes, 'p1'); // D, d1, jour, j1, j2
  assert.deepStrictEqual(cibleDepot(l, etat, 'onglet', 4), { dossierId: null, apres: 'j1', avant: 'j2', epingle: false });
  assert.deepStrictEqual(cibleDepot(l, etat, 'onglet', 3), { dossierId: null, apres: null, avant: 'j1', epingle: false });
  assert.deepStrictEqual(cibleDepot(l, etat, 'onglet', 5), { dossierId: null, apres: 'j2', avant: null, epingle: false });
});

test('un dossier ne se pose jamais dans la zone du jour', () => {
  assert.strictEqual(cibleDepot(sansElement(lignes, 'D'), etat, 'dossier', 3), null);
});

test('au-dessus du séparateur : au niveau de la ligne de dessous', () => {
  const l = sansElement(lignes, 'j1'); // p1, D, d1, jour, j2
  assert.deepStrictEqual(cibleDepot(l, etat, 'onglet', 0), { dossierId: null, apres: null, avant: 'p1', epingle: true });
  // Juste avant d1 : dans le dossier D, en tête.
  assert.deepStrictEqual(cibleDepot(l, etat, 'onglet', 2), { dossierId: 'D', apres: null, avant: 'd1', epingle: true });
  // Juste au-dessus du séparateur : après la ligne du dessus, à son niveau.
  assert.deepStrictEqual(cibleDepot(l, etat, 'onglet', 3), { dossierId: 'D', apres: 'd1', avant: null, epingle: true });
});

test('aucun épinglé : le haut de la liste reste une cible', () => {
  const l: Ligne[] = [{ type: 'separateur', id: 'jour', profondeur: 0 }, { type: 'onglet', id: 'j1', profondeur: 0 }];
  assert.deepStrictEqual(cibleDepot(l, etat, 'onglet', 0), { dossierId: null, apres: null, avant: null, epingle: true });
});
