import * as React from 'react';
import { ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { agir, useEtat } from '@/etat';
import { cn } from '@/lib/utils';
import { HAUTEUR_LIGNE } from './LigneOnglet';

const RETRAIT = 14;

export const LigneDossier = React.memo(function LigneDossier({
  id, profondeur, enRenommage, finRenommage
}: { id: string; profondeur: number; enRenommage: boolean; finRenommage: () => void }) {
  const dossier = useEtat((e) => e.dossiers.find((d) => d.id === id));
  if (!dossier) return null;
  const Icone = dossier.replie ? Folder : FolderOpen;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={!dossier.replie}
      onClick={() => !enRenommage && agir('dossier.replier', { id, oui: !dossier.replie })}
      onContextMenu={(e) => {
        e.preventDefault();
        agir('menu.dossier', { id });
      }}
      style={{ height: HAUTEUR_LIGNE, paddingLeft: 4 + profondeur * RETRAIT }}
      className="group flex items-center gap-1.5 rounded-md pr-1.5 outline-none select-none hover:bg-shell-hover focus-visible:ring-2 focus-visible:ring-accent-escale/60"
    >
      <ChevronRight className={cn('size-3.5 shrink-0 text-shell-muted transition-transform duration-150', !dossier.replie && 'rotate-90')} />
      <Icone className="size-4 shrink-0" style={{ color: dossier.teinte || 'var(--shell-muted)' }} />
      {enRenommage ? (
        <ChampNom
          valeur={dossier.nom}
          valider={(nom) => {
            if (nom && nom !== dossier.nom) agir('dossier.renommer', { id, nom });
            finRenommage();
          }}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{dossier.nom}</span>
      )}
    </div>
  );
});

export function ChampNom({ valeur, valider }: { valeur: string; valider: (nom: string) => void }) {
  const [texte, setTexte] = React.useState(valeur);
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => ref.current?.select(), []);
  return (
    <input
      ref={ref}
      autoFocus
      value={texte}
      maxLength={80}
      onChange={(e) => setTexte(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => valider(texte.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') valider(texte.trim());
        if (e.key === 'Escape') valider(valeur);
      }}
      className="min-w-0 flex-1 rounded bg-shell-input px-1 py-0.5 text-[13px] outline-none ring-1 ring-accent-escale/60"
    />
  );
}
