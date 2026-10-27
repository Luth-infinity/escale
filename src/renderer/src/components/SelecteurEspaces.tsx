import * as React from 'react';
import { motion } from 'motion/react';
import { Plus, Puzzle, Settings, VenetianMask } from 'lucide-react';
import { agir, commandeLocale, useCommande, useEtat } from '@/etat';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { ChampNom } from './LigneDossier';
import { useMouvement } from '@/lib/ressorts';

/** L'icône d'un espace : sa photo, son emoji, ou son initiale. */
export function IconeEspace({ nom, icone, taille }: { nom: string; icone: string | null; taille: string }) {
  if (icone?.startsWith('data:image/')) return <img src={icone} alt="" className="absolute inset-0 size-full rounded-full object-cover" />;
  return icone ? <span className={cn(taille, 'leading-none')}>{icone}</span> : <>{nom.charAt(0).toUpperCase()}</>;
}

function Pastille({ nom, icone, teinte, active }: { nom: string; icone: string | null; teinte: string | null; active: boolean }) {
  const transition = useMouvement();
  return (
    <span className="relative grid size-5 place-items-center">
      {active && (
        // L'anneau de l'espace actif glisse d'une pastille à l'autre.
        <motion.span layoutId="anneau-espace" transition={transition} className="absolute -inset-[3px] rounded-full ring-[1.5px] ring-shell-foreground/25" />
      )}
      <span
        className={cn('relative grid size-5 place-items-center overflow-hidden rounded-full text-[10px] font-semibold transition-colors duration-200', active ? 'text-white' : 'text-shell-muted')}
        style={{ background: active ? teinte || 'var(--accent-escale)' : 'var(--shell-active)' }}
      >
        <IconeEspace nom={nom} icone={icone} taille="text-[12px]" />
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
  // En privé, pas de nom d'espace : un bandeau qui dit où l'on est, et comment en sortir.
  if (espace.prive)
    return (
      <div className="mx-2 mt-2 mb-1 flex h-8 items-center gap-2 rounded-lg bg-shell-active px-2 text-[12.5px]">
        <VenetianMask className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium">{t('Navigation privée')}</span>
        <button
          onClick={() => agir('espace.prive', { nom: t('Navigation privée') })}
          className="h-6 shrink-0 rounded-md px-2 text-[12px] font-medium text-shell-muted transition-colors hover:bg-shell-hover hover:text-shell-foreground"
        >
          {t('Sortir')}
        </button>
      </div>
    );
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

/**
 * Les extensions de l'espace actif, derrière un bouton du pied de barre : leurs
 * icônes s'ouvrent au-dessus, et leurs popups au-dessus d'elles.
 */
function BoutonExtensions() {
  const partition = useEtat((e) => e.espaces.find((x) => x.id === e.espaceActif)?.partition);
  const [ouvert, setOuvert] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOuvert(false);
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(false);
    window.addEventListener('mousedown', dehors);
    window.addEventListener('keydown', echap);
    return () => {
      window.removeEventListener('mousedown', dehors);
      window.removeEventListener('keydown', echap);
    };
  }, [ouvert]);
  if (!partition) return null;
  return (
    // Le panneau se cale sur toute la largeur du pied de barre (son parent
    // positionné), pas sur le bouton : la barre ne fait que 240 px.
    <div ref={ref}>
      {ouvert && (
        <div className="absolute inset-x-2 bottom-full mb-2 rounded-xl border border-shell-border bg-shell-raised p-2 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.45)]">
          <div className="px-1 pb-1.5 text-[11.5px] font-medium text-shell-muted">{t('Extensions')}</div>
          <browser-action-list partition={partition} alignment="top right" />
          <button
            onClick={() => {
              agir('onglet.ouvrir', { url: 'https://chromewebstore.google.com/category/extensions' });
              setOuvert(false);
            }}
            className="mt-1.5 flex h-7 w-full items-center gap-1.5 rounded-md px-1.5 text-left text-[12.5px] text-shell-muted transition-colors hover:bg-shell-hover hover:text-shell-foreground"
          >
            <Plus className="size-3.5" />
            {t('Ajouter des extensions')}
          </button>
        </div>
      )}
      <button
        title={t('Extensions')}
        onClick={() => setOuvert((o) => !o)}
        className={cn(
          'grid size-7 place-items-center rounded-md text-shell-muted transition-colors hover:bg-shell-hover hover:text-shell-foreground',
          ouvert && 'bg-shell-hover text-shell-foreground'
        )}
      >
        <Puzzle className="size-4" />
      </button>
    </div>
  );
}

/** Les espaces, en bas de la barre : un clic bascule, le « + » en crée un. */
export function SelecteurEspaces({ rail = false }: { rail?: boolean }) {
  // L'espace de la navigation privée n'est pas un espace comme les autres : il n'a pas de pastille.
  const tous = useEtat((e) => e.espaces);
  const espaces = React.useMemo(() => tous.filter((e) => !e.prive), [tous]);
  const actif = useEtat((e) => e.espaceActif);
  const enPrive = tous.some((e) => e.prive && e.id === actif);
  return (
    <div className={cn('relative flex shrink-0 items-center gap-1 border-t border-shell-border px-2', rail ? 'flex-col py-2' : 'h-11')}>
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
          <Pastille nom={e.nom} icone={e.icone} teinte={e.teinte} active={e.id === actif} />
        </button>
      ))}
      {!rail && <span className="flex-1" />}
      <button
        title={enPrive ? t('Quitter la navigation privée (Ctrl+Maj+N)') : t('Navigation privée (Ctrl+Maj+N)')}
        aria-pressed={enPrive}
        onClick={() => agir('espace.prive', { nom: t('Navigation privée') })}
        className={cn(
          'grid size-7 place-items-center rounded-md transition-colors hover:bg-shell-hover hover:text-shell-foreground',
          enPrive ? 'bg-shell-active text-shell-foreground' : 'text-shell-muted'
        )}
      >
        <VenetianMask className="size-4" />
      </button>
      <button
        title={t('Nouvel espace')}
        onClick={async () => {
          const id = (await agir('espace.creer', { nom: t('Espace {n}', { n: espaces.length + 1 }) })) as string;
          commandeLocale('renommer-espace', id);
        }}
        className="grid size-7 place-items-center rounded-md text-shell-muted transition-colors hover:bg-shell-hover hover:text-shell-foreground"
      >
        <Plus className="size-4" />
      </button>
      {/* Replié en rail, la barre est trop étroite pour le panneau : la page
          (vue native) le recouvrirait. */}
      {!rail && <BoutonExtensions />}
      {/* Hors macOS, la barre de menus est masquée : sans ce bouton, les
          réglages n'étaient joignables que par Ctrl+, qu'on ne devine pas. */}
      <button
        title={t('Réglages (Ctrl+,)')}
        onClick={() => commandeLocale('reglages')}
        className="grid size-7 place-items-center rounded-md text-shell-muted transition-colors hover:bg-shell-hover hover:text-shell-foreground"
      >
        <Settings className="size-4" />
      </button>
    </div>
  );
}
