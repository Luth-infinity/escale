import * as React from 'react';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { agir, commandeLocale, useCommande, useEtat } from '@/etat';
import { cn } from '@/lib/utils';
import { ChampNom } from './LigneDossier';
import { useMouvement } from '@/lib/ressorts';

function Pastille({ nom, teinte, active }: { nom: string; teinte: string | null; active: boolean }) {
  const transition = useMouvement();
  return (
    <span className="relative grid size-5 place-items-center">
      {active && (
        // L'anneau de l'espace actif glisse d'une pastille à l'autre.
        <motion.span layoutId="anneau-espace" transition={transition} className="absolute -inset-[3px] rounded-full ring-[1.5px] ring-shell-foreground/25" />
      )}
      <span
        className={cn('grid size-5 place-items-center rounded-full text-[10px] font-semibold transition-colors duration-200', active ? 'text-white' : 'text-shell-muted')}
        style={{ background: active ? teinte || 'var(--accent-escale)' : 'var(--shell-active)' }}
      >
        {nom.charAt(0).toUpperCase()}
      </span>
    </span>
  );
}

/** Le nom de l'espace en tête de liste ; renommable sur place. */
export function EnTeteEspace() {
  const espace = useEtat((e) => e.espaces.find((x) => x.id === e.espaceActif));
  const [renommage, setRenommage] = React.useState(false);
  useCommande((nom, id) => {
    if (nom === 'renommer-espace' && id === espace?.id) setRenommage(true);
  });
  if (!espace) return null;
  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        agir('menu.espace', { id: espace.id });
      }}
      className="mx-2 mt-2 mb-1 flex h-7 items-center gap-2 px-2"
    >
      {renommage ? (
        <ChampNom
          valeur={espace.nom}
          valider={(nom) => {
            if (nom && nom !== espace.nom) agir('espace.modifier', { id: espace.id, nom });
            setRenommage(false);
          }}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold tracking-wide text-shell-muted uppercase">{espace.nom}</span>
      )}
    </div>
  );
}

/** Les espaces, en bas de la barre : un clic bascule, le « + » en crée un. */
export function SelecteurEspaces({ rail = false }: { rail?: boolean }) {
  const espaces = useEtat((e) => e.espaces);
  const actif = useEtat((e) => e.espaceActif);
  return (
    <div className={cn('flex shrink-0 items-center gap-1 border-t border-shell-border px-2', rail ? 'flex-col py-2' : 'h-11')}>
      {espaces.map((e, i) => (
        <button
          key={e.id}
          title={`${e.nom}${i < 9 ? ` (Ctrl+${i + 1})` : ''}`}
          onClick={() => agir('espace.activer', { id: e.id })}
          onContextMenu={(ev) => {
            ev.preventDefault();
            agir('menu.espace', { id: e.id });
          }}
          className="grid size-7 place-items-center rounded-md transition-colors hover:bg-shell-hover"
        >
          <Pastille nom={e.nom} teinte={e.teinte} active={e.id === actif} />
        </button>
      ))}
      {!rail && <span className="flex-1" />}
      <button
        title="Nouvel espace"
        onClick={async () => {
          const id = (await agir('espace.creer', { nom: `Espace ${espaces.length + 1}` })) as string;
          commandeLocale('renommer-espace', id);
        }}
        className="grid size-7 place-items-center rounded-md text-shell-muted transition-colors hover:bg-shell-hover hover:text-shell-foreground"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
