import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, X } from 'lucide-react';
import { agir, useMiseAJour } from '@/etat';
import { t } from '@/lib/i18n';
import { useMouvement } from '@/lib/ressorts';

/** Une nouvelle version est publiée : un bandeau discret en bas de la barre. */
export function BandeauMaj({ rail }: { rail: boolean }) {
  const transition = useMouvement();
  const maj = useMiseAJour();
  const [cache, setCache] = React.useState<string | null>(null);
  const visible = maj && cache !== maj.version && !rail;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={transition}
          className="mx-2 mb-2 overflow-hidden"
        >
          <div className="flex items-center gap-2 rounded-lg border border-shell-border bg-shell-raised px-2.5 py-2 text-[12.5px]">
            <Download className="size-4 shrink-0 text-accent-escale" />
            <button onClick={() => agir('maj.ouvrir', { url: maj.url })} className="min-w-0 flex-1 truncate text-left font-medium hover:underline">
              {t('Escale {v} est disponible', { v: maj.version })}
            </button>
            <button onClick={() => setCache(maj.version)} title={t('Plus tard')} className="grid size-5 place-items-center rounded text-shell-muted hover:bg-shell-hover">
              <X className="size-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
