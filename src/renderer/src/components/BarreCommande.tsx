import * as React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Clock, Globe, Pin, Search, SquareStack } from 'lucide-react';
import { agir } from '@/etat';
import { useMouvement } from '@/lib/ressorts';
import { useModalePage } from '@/lib/modale';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

type Resultat = {
  type: 'onglet' | 'epingle' | 'historique' | 'url' | 'recherche' | 'suggestion'; titre: string; url?: string; id?: string; requete?: string; site?: string;
};

// Les recherches sont titrées ici, dans la langue du shell.
const titre = (r: Resultat) =>
  r.type === 'recherche' && r.requete !== undefined
    ? r.site
      ? t('Rechercher « {q} » sur {site}', { q: r.requete, site: r.site })
      : t('Rechercher « {q} »', { q: r.requete })
    : r.titre;

const ICONES = { onglet: SquareStack, epingle: Pin, historique: Clock, url: Globe, recherche: Search, suggestion: Search };
const LIBELLES = { onglet: "Aller à l'onglet", epingle: "Aller à l'onglet", historique: 'Ouvrir', url: 'Ouvrir', recherche: 'Rechercher', suggestion: 'Rechercher' };
const DELAI_SUGGESTIONS = 120;

/**
 * La barre de commande (Cmd+T, Cmd+L). Modale du shell : la page native est
 * masquée le temps de l'ouverture (elle passerait par-dessus) et remplacée par
 * son image, sous un voile léger.
 */
export function BarreCommande({ nouvelOnglet, depuis, fermer }: { nouvelOnglet: boolean; depuis?: number; fermer: () => void }) {
  const transition = useMouvement();
  const [texte, setTexte] = React.useState('');
  const [locaux, setLocaux] = React.useState<Resultat[]>([]);
  const [web, setWeb] = React.useState<string[]>([]);
  const [actif, setActif] = React.useState(0);
  const champ = React.useRef<HTMLInputElement>(null);
  const fond = useModalePage();
  React.useLayoutEffect(() => {
    champ.current?.focus();
    // Latence touche → première image (cible < 100 ms).
    if (depuis) requestAnimationFrame(() => console.debug(`[escale] barre de commande : ${Date.now() - depuis} ms`));
  }, [depuis]);

  React.useEffect(() => {
    let vivant = true;
    agir('commande.resoudre', { texte }).then((r) => vivant && setLocaux(r as Resultat[]));
    const minuteur = window.setTimeout(() => {
      agir('commande.suggestions', { texte }).then((s) => vivant && setWeb(s as string[]));
    }, DELAI_SUGGESTIONS);
    setActif(0);
    return () => {
      vivant = false;
      window.clearTimeout(minuteur);
    };
  }, [texte]);

  const resultats: Resultat[] = React.useMemo(() => {
    const recherche = locaux.filter((r) => r.type === 'recherche');
    const autres = locaux.filter((r) => r.type !== 'recherche');
    const suggestions = web
      .filter((s) => s.toLowerCase() !== texte.trim().toLowerCase())
      .map((s): Resultat => ({ type: 'suggestion', titre: s, url: s }));
    return [...autres, ...recherche, ...suggestions].slice(0, 8);
  }, [locaux, web, texte]);

  const ouvrir = (r: Resultat | undefined) => {
    if (!r) return;
    agir('commande.ouvrir', { type: r.type, url: r.url, id: r.id, nouvelOnglet });
    fermer();
  };

  return (
    <div className="absolute inset-0 z-20" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      {fond && <img src={fond} alt="" className="pointer-events-none absolute inset-0 size-full rounded-[10px] object-cover" />}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[10px] bg-black/10 dark:bg-black/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12 }}
      />
      <motion.div
        role="dialog"
        aria-label={t('Barre de commande')}
        initial={{ opacity: 0, scale: 0.98, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={transition}
        className="absolute top-[14%] left-1/2 w-[min(640px,calc(100%-48px))] -translate-x-1/2 overflow-hidden rounded-xl border border-shell-border bg-shell-raised shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)]"
      >
        <div className="flex items-center gap-2.5 border-b border-shell-border px-4">
          <Search className="size-4 shrink-0 text-shell-muted" />
          <input
            ref={champ}
            value={texte}
            spellCheck={false}
            placeholder={nouvelOnglet ? t('Rechercher ou saisir une adresse') : t('Aller à une adresse ou un onglet')}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') fermer();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActif((i) => Math.min(resultats.length - 1, i + 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActif((i) => Math.max(0, i - 1));
              }
              if (e.key === 'Enter') ouvrir(resultats[actif]);
            }}
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-shell-muted"
          />
        </div>
        {resultats.length > 0 && (
          <ul className="relative p-1.5" role="listbox">
            {resultats.map((r, i) => {
              const Icone = ICONES[r.type];
              return (
                <motion.li
                  layout="position"
                  transition={transition}
                  key={`${r.type}:${r.id || r.url}`}
                  role="option"
                  aria-selected={i === actif}
                  onMouseMove={() => setActif(i)}
                  onClick={() => ouvrir(r)}
                  className="relative flex h-10 cursor-default items-center gap-3 rounded-lg px-3 text-[13.5px]"
                >
                  {i === actif && (
                    <motion.div layoutId="commande-active" transition={transition} className="absolute inset-0 rounded-lg bg-shell-hover" />
                  )}
                  <Icone className={cn('relative size-4 shrink-0', i === actif ? 'text-accent-escale' : 'text-shell-muted')} />
                  <span className="relative min-w-0 flex-1 truncate">{titre(r)}</span>
                  {r.url && r.type !== 'suggestion' && r.type !== 'recherche' && (
                    <span className="relative max-w-[40%] shrink-0 truncate text-[12px] text-shell-muted">{r.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                  )}
                  {i === actif && (
                    <span className="relative flex shrink-0 items-center gap-1 text-[11.5px] text-shell-muted">
                      {t(LIBELLES[r.type])} <ArrowRight className="size-3" />
                    </span>
                  )}
                </motion.li>
              );
            })}
          </ul>
        )}
      </motion.div>
    </div>
  );
}
