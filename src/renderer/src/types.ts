// Miroir des types de src/main/model/arbre.js.
export type Espace = { id: string; nom: string; icone: string | null; teinte: string | null; partition: string };
export type Dossier = {
  id: string; espaceId: string; parentId: string | null; nom: string; teinte: string | null; replie: boolean; ordre: string;
};
export type Onglet = {
  id: string; espaceId: string; dossierId: string | null; epingle: boolean; url: string; titre: string;
  favicon: string | null; ordre: string; derniereActivite: number; muet: boolean; zoom: number;
};
export type Etat = {
  version: 1; espaces: Espace[]; dossiers: Dossier[]; onglets: Onglet[]; espaceActif: string; ongletActif: string | null;
};
export type Delta =
  | { type: 'tab:added'; onglet: Onglet }
  | { type: 'tab:removed'; id: string; onglet: Onglet }
  | { type: 'tab:meta'; id: string; patch: Partial<Onglet> }
  | { type: 'tab:moved'; id: string; espaceId: string; dossierId: string | null; epingle: boolean; ordre: string }
  | { type: 'folder:added'; dossier: Dossier }
  | { type: 'folder:removed'; id: string }
  | { type: 'folder:changed'; id: string; patch: Partial<Dossier> }
  | { type: 'space:added'; espace: Espace }
  | { type: 'space:removed'; id: string }
  | { type: 'space:changed'; id: string; patch: Partial<Espace> }
  | { type: 'active:changed'; espaceActif: string; ongletActif: string | null };

declare global {
  interface Window {
    escale: {
      plateforme: string;
      etatInitial(): Promise<Etat>;
      surDelta(fn: (d: Delta) => void): () => void;
      action(nom: string, payload?: unknown): Promise<unknown>;
    };
  }
}
