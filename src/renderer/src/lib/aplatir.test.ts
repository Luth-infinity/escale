import test from 'node:test';
import assert from 'node:assert';
import { aplatir } from './aplatir.ts';
import type { Etat } from '../types.ts';

const base = (): Etat => ({
  version: 1,
  espaces: [{ id: 'e', nom: 'Perso', icone: null, teinte: null, partition: 'persist:space-e' }],
  dossiers: [],
  onglets: [],
  espaceActif: 'e',
  ongletActif: null,
  reglages: {} as Etat['reglages']
});
const onglet = (id: string, ordre: string, extra: Partial<Etat['onglets'][0]> = {}) => ({
  id, espaceId: 'e', dossierId: null, epingle: false, url: `https://${id}.fr`, titre: id, favicon: null,
  ordre, derniereActivite: 0, muet: false, zoom: 1, ...extra
});
const dossier = (id: string, ordre: string, parentId: string | null = null, replie = false) => ({
  id, espaceId: 'e', parentId, nom: id, teinte: null, replie, ordre
});

test('épinglés et dossiers, puis le séparateur, puis les onglets du jour, dans l’ordre', () => {
  const e = base();
  e.dossiers = [dossier('D', 'b')];
  e.onglets = [onglet('j2', 'b'), onglet('p1', 'a', { epingle: true }), onglet('j1', 'a'), onglet('dans', 'a', { epingle: true, dossierId: 'D' })];
  assert.deepStrictEqual(
    aplatir(e, 'e').map((l) => `${l.type}:${l.id}:${l.profondeur}`),
    ['onglet:p1:0', 'dossier:D:0', 'onglet:dans:1', 'separateur:jour:0', 'onglet:j1:0', 'onglet:j2:0']
  );
});

test('un dossier replié masque ses enfants', () => {
  const e = base();
  e.dossiers = [dossier('D', 'a', null, true), dossier('S', 'a', 'D')];
  e.onglets = [onglet('x', 'b', { epingle: true, dossierId: 'D' })];
  assert.deepStrictEqual(aplatir(e, 'e').map((l) => l.id), ['D', 'jour']);
});

test('profondeur affichée plafonnée à 3', () => {
  const e = base();
  e.dossiers = ['A', 'B', 'C', 'D', 'E'].map((id, i, t) => dossier(id, 'a', i ? t[i - 1] : null));
  const lignes = aplatir(e, 'e');
  assert.deepStrictEqual(lignes.map((l) => l.profondeur), [0, 1, 2, 3, 3, 0]);
});

test('seul l’espace demandé est rendu', () => {
  const e = base();
  e.onglets = [onglet('a', 'a'), { ...onglet('b', 'b'), espaceId: 'autre' }];
  assert.deepStrictEqual(aplatir(e, 'e').map((l) => l.id), ['jour', 'a']);
});
