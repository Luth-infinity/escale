import type { Etat } from '../types.ts';
import type { Ligne } from './aplatir.ts';

export type Depot = { dossierId: string | null; apres: string | null; avant: string | null; epingle: boolean };

/** Les lignes sans l'élément saisi (et, pour un dossier, sans son contenu). */
export function sansElement(lignes: Ligne[], id: string): Ligne[] {
  const i = lignes.findIndex((l) => l.id === id);
  if (i < 0) return lignes;
  let fin = i + 1;
  if (lignes[i].type === 'dossier') {
    while (fin < lignes.length && lignes[fin].type !== 'separateur' && lignes[fin].profondeur > lignes[i].profondeur) fin++;
  }
  return [...lignes.slice(0, i), ...lignes.slice(fin)];
}

function parent(etat: Etat, l: Ligne): string | null {
  if (l.type === 'dossier') return etat.dossiers.find((d) => d.id === l.id)?.parentId ?? null;
  return etat.onglets.find((o) => o.id === l.id)?.dossierId ?? null;
}

/**
 * Où tombe un élément lâché dans l'interstice `g` (avant lignes[g]).
 * Sous le séparateur : la zone du jour. Au-dessus : au niveau de la ligne de
 * dessous, ou de celle de dessus juste avant le séparateur.
 */
export function cibleDepot(lignes: Ligne[], etat: Etat, type: 'onglet' | 'dossier', g: number): Depot | null {
  const sep = lignes.findIndex((l) => l.type === 'separateur');
  if (g > sep) {
    if (type === 'dossier') return null;
    return {
      dossierId: null,
      apres: g - 1 > sep ? lignes[g - 1].id : null,
      avant: lignes[g]?.id ?? null,
      epingle: false
    };
  }
  if (g < sep) return { dossierId: parent(etat, lignes[g]), apres: null, avant: lignes[g].id, epingle: true };
  if (g === 0) return { dossierId: null, apres: null, avant: null, epingle: true };
  const dessus = lignes[g - 1];
  return { dossierId: parent(etat, dessus), apres: dessus.id, avant: null, epingle: true };
}
