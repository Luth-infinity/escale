import * as React from 'react';
import { motion } from 'motion/react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { agir } from '@/etat';
import { useMouvement } from '@/lib/ressorts';

/**
 * Rechercher dans la page (Cmd+F). Elle se loge au-dessus de la page, qui se
 * décale d'autant : rien ne passe sous la vue native.
 */
export function BarreRecherche({ fermer }: { fermer: () => void }) {
  const transition = useMouvement();
  const [texte, setTexte] = React.useState('');
  React.useEffect(() => () => void agir('page.chercher', { texte: '', fin: true }), []);
  const chercher = (arriere = false) => texte && agir('page.chercher', { texte, arriere });
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 40, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={transition}
      className="flex shrink-0 items-center gap-1.5 overflow-hidden px-2"
    >
      <input
        autoFocus
        value={texte}
        placeholder="Rechercher dans la page"
        onChange={(e) => {
          setTexte(e.target.value);
          agir('page.chercher', { texte: e.target.value });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') fermer();
          if (e.key === 'Enter') chercher(e.shiftKey);
        }}
        className="h-7 w-64 rounded-md bg-shell-input px-2 text-[13px] outline-none focus:ring-2 focus:ring-accent-escale/50"
      />
      <button title="Précédent" onClick={() => chercher(true)} className="grid size-7 place-items-center rounded-md text-shell-muted hover:bg-shell-hover">
        <ChevronUp className="size-4" />
      </button>
      <button title="Suivant" onClick={() => chercher(false)} className="grid size-7 place-items-center rounded-md text-shell-muted hover:bg-shell-hover">
        <ChevronDown className="size-4" />
      </button>
      <button title="Fermer" onClick={fermer} className="ml-auto grid size-7 place-items-center rounded-md text-shell-muted hover:bg-shell-hover">
        <X className="size-4" />
      </button>
    </motion.div>
  );
}
