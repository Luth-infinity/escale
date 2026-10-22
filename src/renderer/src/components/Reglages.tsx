import * as React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { agir, useEtat } from '@/etat';
import { t } from '@/lib/i18n';
import { useModalePage } from '@/lib/modale';
import { useMouvement } from '@/lib/ressorts';
import { cn } from '@/lib/utils';
import type { Reglages as R } from '@/types';

type Choix<K extends keyof R> = { cle: K; titre: string; options: [R[K], string][] };

const CHOIX = [
  { cle: 'theme', titre: 'Thème', options: [['system', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']] },
  { cle: 'langue', titre: 'Langue', options: [['system', 'Système'], ['fr', 'Français'], ['en', 'English']] },
  { cle: 'moteur', titre: 'Moteur de recherche', options: [['google', 'Google'], ['duckduckgo', 'DuckDuckGo'], ['bing', 'Bing'], ['qwant', 'Qwant'], ['ecosia', 'Ecosia']] },
  { cle: 'fermetureAutoHeures', titre: 'Fermer les onglets du jour inactifs après', options: [[6, '6 h'], [12, '12 h'], [24, '24 h'], [168, '7 jours'], [0, 'Jamais']] },
  { cle: 'veilleMinutes', titre: 'Mettre en veille les onglets inactifs après', options: [[10, '10 min'], [20, '20 min'], [60, '1 h'], [0, 'Jamais']] }
] as Choix<keyof R>[];

const INTERRUPTEURS: { cle: 'suggestions' | 'bloqueur' | 'ambiance' | 'sponsors'; titre: string; detail: string }[] = [
  { cle: 'suggestions', titre: 'Suggestions de recherche', detail: 'Envoie ce que vous tapez au moteur (jamais une adresse).' },
  { cle: 'bloqueur', titre: 'Bloquer les publicités et les traqueurs', detail: 'Liste intégrée des principales régies.' },
  { cle: 'ambiance', titre: 'Ambiance sur YouTube', detail: 'Prolonge la vidéo derrière la page pendant la lecture.' },
  { cle: 'sponsors', titre: 'Passer sponsors et pubs sur YouTube', detail: 'Passages signalés par SponsorBlock, et bouton « Ignorer » des publicités.' }
];

function Segments<K extends keyof R>({ choix, valeur }: { choix: Choix<K>; valeur: R[K] }) {
  const transition = useMouvement();
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-shell-input p-0.5">
      {choix.options.map(([v, libelle]) => (
        <button
          key={String(v)}
          onClick={() => agir('reglages.modifier', { [choix.cle]: v })}
          className={cn('relative rounded-md px-2.5 py-1 text-[12.5px] transition-colors duration-100', v === valeur ? 'text-shell-foreground' : 'text-shell-muted hover:text-shell-foreground')}
        >
          {v === valeur && (
            <motion.span layoutId={`segment-${String(choix.cle)}`} transition={transition} className="absolute inset-0 rounded-md bg-shell-raised shadow-[0_0_0_1px_var(--shell-border)]" />
          )}
          <span className="relative">{t(libelle)}</span>
        </button>
      ))}
    </div>
  );
}

function Interrupteur({ actif, onChange, titre }: { actif: boolean; onChange: (v: boolean) => void; titre: string }) {
  const transition = useMouvement();
  return (
    <button
      role="switch"
      aria-checked={actif}
      aria-label={titre}
      onClick={() => onChange(!actif)}
      className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150', actif ? 'bg-accent-escale' : 'bg-shell-active')}
    >
      <motion.span layout transition={transition} className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow', actif ? 'right-0.5' : 'left-0.5')} />
    </button>
  );
}

type Import = { importes?: number; espace?: string; erreur?: string };

/** Reprendre les sessions de Firefox (cookies) dans l'espace actif. */
function ImportFirefox() {
  const [etat, setEtat] = React.useState<'repos' | 'en-cours' | Import>('repos');
  const lancer = async () => {
    setEtat('en-cours');
    try {
      setEtat((await agir('import.firefox')) as Import);
    } catch {
      setEtat({ erreur: 'echec' });
    }
  };
  const resultat =
    typeof etat === 'object'
      ? etat.erreur === 'introuvable'
        ? t('Aucun profil Firefox trouvé sur cet ordinateur.')
        : etat.erreur
          ? t("L'import n'a pas abouti.")
          : t('{n} cookies importés dans « {espace} ».', { n: etat.importes ?? 0, espace: etat.espace ?? '' })
      : null;
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{t('Importer depuis Firefox')}</div>
        <div className="text-[12px] text-shell-muted">
          {resultat ?? t('Reprend vos sessions Firefox dans l’espace actif : vous restez connecté aux mêmes sites, Google compris.')}
        </div>
      </div>
      <button
        onClick={lancer}
        disabled={etat === 'en-cours'}
        className="h-7 shrink-0 rounded-lg border border-shell-border px-3 text-[12.5px] font-medium hover:bg-shell-hover disabled:opacity-50"
      >
        {etat === 'en-cours' ? t('Import…') : t('Importer')}
      </button>
    </div>
  );
}

export function Reglages({ fermer }: { fermer: () => void }) {
  const transition = useMouvement();
  const fond = useModalePage();
  const reglages = useEtat((e) => e.reglages);
  React.useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && fermer();
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [fermer]);
  return (
    <div className="absolute inset-0 z-20" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      {fond && <img src={fond} alt="" className="pointer-events-none absolute inset-0 size-full rounded-[10px] object-cover" />}
      <motion.div className="pointer-events-none absolute inset-0 rounded-[10px] bg-black/10 dark:bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} />
      <motion.div
        role="dialog"
        aria-label={t('Réglages')}
        initial={{ opacity: 0, scale: 0.98, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={transition}
        className="absolute top-[8%] left-1/2 max-h-[84%] w-[min(560px,calc(100%-48px))] -translate-x-1/2 overflow-y-auto rounded-xl border border-shell-border bg-shell-raised p-5 shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold tracking-tight">{t('Réglages')}</h2>
          <button onClick={fermer} title={t('Fermer')} className="grid size-7 place-items-center rounded-md text-shell-muted hover:bg-shell-hover">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4">
          {CHOIX.map((c) => (
            <div key={String(c.cle)} className="space-y-1.5">
              <div className="text-[12.5px] font-medium text-shell-muted">{t(c.titre)}</div>
              <Segments choix={c} valeur={reglages[c.cle]} />
            </div>
          ))}
          {INTERRUPTEURS.map((i) => (
            <div key={i.cle} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{t(i.titre)}</div>
                <div className="text-[12px] text-shell-muted">{t(i.detail)}</div>
              </div>
              <Interrupteur actif={reglages[i.cle]} titre={t(i.titre)} onChange={(v) => agir('reglages.modifier', { [i.cle]: v })} />
            </div>
          ))}
          <ImportFirefox />
        </div>
      </motion.div>
    </div>
  );
}
