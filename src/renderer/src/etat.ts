import * as React from 'react';
import type { Delta, Etat, Nav } from './types';

/**
 * L'état côté shell : un état complet au démarrage, puis des deltas. Chaque
 * delta ne remplace que les objets qu'il touche : un sélecteur qui lit un
 * onglet inchangé reçoit la même référence, et sa ligne ne se rerend pas.
 */
type Vivant = { vivant: boolean; son: boolean };
type MiseAJour = { version: string; url: string };
type Store = { etat: Etat | null; nav: Nav | null; vivants: Record<string, Vivant>; maj: MiseAJour | null };

let store: Store = { etat: null, nav: null, vivants: {}, maj: null };
const ecouteurs = new Set<() => void>();
const commandes = new Set<(nom: string, id?: string, t?: number) => void>();
const transitions = new Set<(de: string, vers: string | null) => void>();

function publier(suivant: Store) {
  store = suivant;
  for (const f of ecouteurs) f();
}

const remplacer = <T extends { id: string }>(liste: T[], id: string, patch: Partial<T>) =>
  liste.map((x) => (x.id === id ? { ...x, ...patch } : x));

function appliquer(e: Etat, d: Delta): Etat {
  switch (d.type) {
    case 'tab:added':
      return { ...e, onglets: [...e.onglets, d.onglet] };
    case 'tab:removed':
      return { ...e, onglets: e.onglets.filter((o) => o.id !== d.id) };
    case 'tab:meta':
      return { ...e, onglets: remplacer(e.onglets, d.id, d.patch) };
    case 'tab:moved':
      return { ...e, onglets: remplacer(e.onglets, d.id, { espaceId: d.espaceId, dossierId: d.dossierId, epingle: d.epingle, ordre: d.ordre }) };
    case 'folder:added':
      return { ...e, dossiers: [...e.dossiers, d.dossier] };
    case 'folder:removed':
      return { ...e, dossiers: e.dossiers.filter((x) => x.id !== d.id) };
    case 'folder:changed':
      return { ...e, dossiers: remplacer(e.dossiers, d.id, d.patch) };
    case 'space:added':
      return { ...e, espaces: [...e.espaces, d.espace] };
    case 'space:removed':
      return { ...e, espaces: e.espaces.filter((x) => x.id !== d.id) };
    case 'space:changed':
      return { ...e, espaces: remplacer(e.espaces, d.id, d.patch) };
    case 'active:changed':
      return { ...e, espaceActif: d.espaceActif, ongletActif: d.ongletActif };
    case 'settings:changed':
      return { ...e, reglages: { ...e.reglages, ...d.patch } };
    default:
      return e;
  }
}

export async function demarrer() {
  const etat = await window.escale.etatInitial();
  publier({ ...store, etat });
  window.escale.surDelta((d) => {
    if (d.type === 'nav:state') {
      const { type: _t, ...nav } = d;
      return publier({ ...store, nav });
    }
    if (d.type === 'tab:etat') return publier({ ...store, vivants: { ...store.vivants, [d.id]: { vivant: d.vivant, son: d.son } } });
    if (d.type === 'update:available') return publier({ ...store, maj: { version: d.version, url: d.url } });
    if (d.type === 'page:transition') {
      for (const f of transitions) f(d.de, d.vers);
      return;
    }
    if (d.type === 'ui:commande') {
      for (const f of commandes) f(d.nom, d.id, d.t);
      return;
    }
    if (store.etat) publier({ ...store, etat: appliquer(store.etat, d) });
  });
}

const abonner = (f: () => void) => {
  ecouteurs.add(f);
  return () => ecouteurs.delete(f);
};

/** Lit une partie de l'état ; le composant ne se rerend que si elle change. */
export function useEtat<T>(selection: (e: Etat) => T): T {
  return React.useSyncExternalStore(abonner, () => selection(store.etat as Etat));
}
export const useMiseAJour = () => React.useSyncExternalStore(abonner, () => store.maj);
export const useNav = () => React.useSyncExternalStore(abonner, () => store.nav);
export const useVivant = (id: string) => React.useSyncExternalStore(abonner, () => store.vivants[id]);
export const lireEtat = () => store.etat as Etat;
export const etatPret = () => store.etat !== null;
export const useEtatPret = () => React.useSyncExternalStore(abonner, () => store.etat !== null);

/** Une commande d'interface émise par le shell lui-même (même canal que le menu). */
export function commandeLocale(nom: string, id?: string) {
  for (const f of commandes) f(nom, id);
}

/** Les commandes d'interface envoyées par le menu natif (Cmd+T, Cmd+F…). */
export function useCommande(f: (nom: string, id?: string, t?: number) => void) {
  const ref = React.useRef(f);
  ref.current = f;
  React.useEffect(() => {
    const ecoute = (nom: string, id?: string, t?: number) => ref.current(nom, id, t);
    commandes.add(ecoute);
    return () => void commandes.delete(ecoute);
  }, []);
}

/** Le changement d'onglet : l'image sortante et la dernière image de l'entrante. */
export function useTransitionPage(f: (de: string, vers: string | null) => void) {
  const ref = React.useRef(f);
  ref.current = f;
  React.useEffect(() => {
    const ecoute = (de: string, vers: string | null) => ref.current(de, vers);
    transitions.add(ecoute);
    return () => void transitions.delete(ecoute);
  }, []);
}

export const agir = (nom: string, payload: unknown = {}) => window.escale.action(nom, payload);
