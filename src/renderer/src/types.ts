// Miroir des types de src/main/model/arbre.js.
export type Espace = { id: string; nom: string; icone: string | null; teinte: string | null; partition: string };
export type Dossier = {
  id: string; espaceId: string; parentId: string | null; nom: string; teinte: string | null; replie: boolean; ordre: string;
};
export type Onglet = {
  id: string; espaceId: string; dossierId: string | null; epingle: boolean; url: string; titre: string;
  favicon: string | null; ordre: string; derniereActivite: number; muet: boolean; zoom: number;
};
export type Reglages = {
  fermetureAutoHeures: number; veilleMinutes: number; bloqueur: boolean; suggestions: boolean; moteur: string;
  langue: string; theme: string; barreRepliee: boolean; zoom: Record<string, number>; derniereVersionVue: string | null;
};
export type Etat = {
  version: 1; espaces: Espace[]; dossiers: Dossier[]; onglets: Onglet[]; espaceActif: string; ongletActif: string | null;
  actifs?: Record<string, string>; // espace → dernier onglet consulté
  reglages: Reglages;
};
export type Nav = { id: string; url: string; peutReculer: boolean; peutAvancer: boolean; chargement: boolean };
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
  | { type: 'active:changed'; espaceActif: string; ongletActif: string | null }
  | { type: 'tab:etat'; id: string; vivant: boolean; son: boolean }
  | ({ type: 'nav:state' } & Nav)
  | { type: 'settings:changed'; patch: Partial<Reglages> }
  | { type: 'ui:commande'; nom: string; id?: string; t?: number }
  | { type: 'page:transition'; de: string; vers: string | null }
  | { type: 'update:available'; version: string; url: string; page: string; notes: string }
  | ({ type: 'dialogue:ouvrir' } & Question);

/** Une question du process principal, posée en modale (src/main/dialogue.js). */
export type Question = {
  id: string; titre: string; detail: string; points: string[]; avertissement: string;
  annuler: string; confirmer: string; ton: 'normal' | 'danger';
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // Fournie par electron-chrome-extensions (preload du shell).
      'browser-action-list': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        partition?: string;
        alignment?: string;
        tab?: number;
      };
    }
  }
}

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
