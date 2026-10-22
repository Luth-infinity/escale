import * as React from 'react';
import { motion } from 'motion/react';
import { repondre } from '@/etat';
import { useModalePage } from '@/lib/modale';
import { useMouvement } from '@/lib/ressorts';
import { cn } from '@/lib/utils';
import type { Question } from '@/types';

/**
 * Une question du process principal (permission, extension, téléchargement,
 * lien externe), dans le style des autres modales. Échap ou un clic à côté
 * valent refus : annuler reste toujours le choix sans risque.
 */
export function Dialogue({ question }: { question: Question }) {
  const transition = useMouvement();
  const fond = useModalePage();
  const { id, titre, detail, points, avertissement, annuler, confirmer, ton } = question;
  const refuser = React.useCallback(() => repondre(id, false), [id]);
  const boutonAnnuler = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    boutonAnnuler.current?.focus();
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && refuser();
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [refuser]);
  return (
    <div className="absolute inset-0 z-30" onMouseDown={(e) => e.target === e.currentTarget && refuser()}>
      {fond && <img src={fond} alt="" className="pointer-events-none absolute inset-0 size-full rounded-[10px] object-cover" />}
      <motion.div className="pointer-events-none absolute inset-0 rounded-[10px] bg-black/10 dark:bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} />
      <motion.div
        key={id}
        role="alertdialog"
        aria-label={titre}
        initial={{ opacity: 0, scale: 0.98, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={transition}
        className="absolute top-[14%] left-1/2 w-[min(440px,calc(100%-48px))] -translate-x-1/2 rounded-xl border border-shell-border bg-shell-raised p-5 shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)]"
      >
        <h2 className="text-[15px] font-semibold tracking-tight [overflow-wrap:anywhere]">{titre}</h2>
        {detail && <p className="mt-2 text-[13px] text-shell-muted [overflow-wrap:anywhere]">{detail}</p>}
        {points.length > 0 && (
          <ul className="mt-2.5 space-y-1.5 text-[13px]">
            {points.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent-escale" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
        {avertissement && <p className="mt-3 text-[12.5px] text-shell-muted">{avertissement}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={boutonAnnuler}
            onClick={refuser}
            className="h-8 rounded-lg border border-shell-border px-3.5 text-[13px] font-medium outline-none hover:bg-shell-hover focus-visible:bg-shell-hover"
          >
            {annuler}
          </button>
          <button
            onClick={() => repondre(id, true)}
            className={cn(
              'h-8 rounded-lg px-3.5 text-[13px] font-medium outline-none',
              ton === 'danger'
                ? 'bg-red-500/12 text-red-600 hover:bg-red-500/20 focus-visible:bg-red-500/20 dark:text-red-400'
                : 'bg-shell-foreground text-shell-raised focus-visible:opacity-90'
            )}
          >
            {confirmer}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
