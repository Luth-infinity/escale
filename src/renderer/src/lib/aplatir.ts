import type { Etat } from '../types.ts';

export type Ligne = { type: 'onglet' | 'dossier' | 'separateur'; id: string; profondeur: number };

const PROFONDEUR_MAX = 3;
const parOrdre = (a: { ordre: string }, b: { ordre: string }) => (a.ordre < b.ordre ? -1 : a.ordre > b.ordre ? 1 : 0);

/**
 * L'arbre d'un espace mis à plat pour la liste virtualisée : épinglés et
 * dossiers (dépliés), le séparateur du jour, puis les onglets du jour.
 */
export function aplatir(etat: Etat, espaceId: string): Ligne[] {
  const dossiers = etat.dossiers.filter((d) => d.espaceId === espaceId);
  const onglets = etat.onglets.filter((o) => o.espaceId === espaceId);
  const lignes: Ligne[] = [];

  const zone = (parentId: string | null, profondeur: number) => {
    const enfants = [
      ...dossiers.filter((d) => d.parentId === parentId).map((d) => ({ type: 'dossier' as const, id: d.id, ordre: d.ordre, d })),
      ...onglets.filter((o) => o.epingle && o.dossierId === parentId).map((o) => ({ type: 'onglet' as const, id: o.id, ordre: o.ordre, d: null }))
    ].sort(parOrdre);
    for (const e of enfants) {
      lignes.push({ type: e.type, id: e.id, profondeur: Math.min(profondeur, PROFONDEUR_MAX) });
      if (e.d && !e.d.replie) zone(e.id, profondeur + 1);
    }
  };
  zone(null, 0);

  lignes.push({ type: 'separateur', id: 'jour', profondeur: 0 });
  for (const o of onglets.filter((x) => !x.epingle).sort(parOrdre)) lignes.push({ type: 'onglet', id: o.id, profondeur: 0 });
  return lignes;
}
