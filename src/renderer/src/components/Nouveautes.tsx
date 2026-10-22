import * as React from 'react';
import { motion } from 'motion/react';
import { agir } from '@/etat';
import { t } from '@/lib/i18n';
import { useModalePage } from '@/lib/modale';
import { useMouvement } from '@/lib/ressorts';

/** « Nouveautés » : montrée une fois au premier lancement d'une nouvelle version. */
export function Nouveautes({ version, points, fermer }: { version: string; points: string[]; fermer: () => void }) {
  const transition = useMouvement();
  const fond = useModalePage();
  const finir = () => {
    agir('reglages.modifier', { derniereVersionVue: version });
    fermer();
  };
  return (
    <div className="absolute inset-0 z-20">
      {fond && <img src={fond} alt="" className="pointer-events-none absolute inset-0 size-full rounded-[10px] object-cover" />}
      <div className="pointer-events-none absolute inset-0 rounded-[10px] bg-black/10 dark:bg-black/30" />
      <motion.div
        role="dialog"
        aria-label={t('Nouveautés')}
        initial={{ opacity: 0, scale: 0.98, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={transition}
        className="absolute top-[14%] left-1/2 w-[min(480px,calc(100%-48px))] -translate-x-1/2 rounded-xl border border-shell-border bg-shell-raised p-5 shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)]"
      >
        <h2 className="text-[17px] font-semibold tracking-tight">{t('Nouveautés de la {v}', { v: version })}</h2>
        <ul className="mt-3 space-y-1.5 text-[13.5px]">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent-escale" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <button onClick={finir} className="mt-5 h-8 rounded-lg bg-shell-foreground px-3.5 text-[13px] font-medium text-shell-raised">
          {t('Compris')}
        </button>
      </motion.div>
    </div>
  );
}
