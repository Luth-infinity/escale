import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, RotateCw, X } from 'lucide-react';
import { agir, useMiseAJour } from '@/etat';
import { t } from '@/lib/i18n';
import { useMouvement } from '@/lib/ressorts';

/**
 * Une nouvelle version est publiée : un bandeau discret en bas de la barre.
 * Sous Windows, elle s'installe d'ici (téléchargement, puis redémarrage à la
 * demande) ; ailleurs, le bandeau mène à la page de la version.
 */
export function BandeauMaj({ rail }: { rail: boolean }) {
  const transition = useMouvement();
  const maj = useMiseAJour();
  const [cache, setCache] = React.useState<string | null>(null);
  const [peutInstaller, setPeutInstaller] = React.useState(false);
  const [lance, setLance] = React.useState(false);
  React.useEffect(() => {
    agir('maj.peutInstaller').then((r) => setPeutInstaller(Boolean(r)));
  }, []);
  const visible = maj && cache !== maj.version && !rail;
  const enCours = lance && !maj?.pret && !maj?.erreur;
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
          <div className="rounded-lg border border-shell-border bg-shell-raised px-2.5 py-2 text-[12.5px]">
            <div className="flex items-center gap-2">
              <Download className="size-4 shrink-0 text-accent-escale" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {maj.pret ? t('Escale {v} est prêt', { v: maj.version }) : t('Escale {v} est disponible', { v: maj.version })}
              </span>
              {!enCours && !maj.pret && (
                <button onClick={() => setCache(maj.version)} title={t('Plus tard')} className="grid size-5 place-items-center rounded text-shell-muted hover:bg-shell-hover">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            {enCours && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-shell-active">
                <div className="h-full rounded-full bg-accent-escale transition-[width] duration-300" style={{ width: `${maj.pourcent ?? 2}%` }} />
              </div>
            )}
            {maj.erreur && <div className="mt-1 text-[11.5px] text-red-500">{t('La mise à jour n’a pas pu se télécharger.')}</div>}
            {!enCours && (
              <div className="mt-1.5 flex gap-1.5">
                {maj.pret ? (
                  <button onClick={() => agir('maj.installer')} className="flex h-6 items-center gap-1 rounded-md bg-accent-escale px-2.5 text-[12px] font-medium text-white">
                    <RotateCw className="size-3" />
                    {t('Redémarrer')}
                  </button>
                ) : peutInstaller ? (
                  <button
                    onClick={() => {
                      setLance(true);
                      agir('maj.telecharger');
                    }}
                    className="h-6 rounded-md bg-accent-escale px-2.5 text-[12px] font-medium text-white"
                  >
                    {maj.erreur ? t('Réessayer') : t('Installer')}
                  </button>
                ) : null}
                <button onClick={() => agir('maj.ouvrir', { url: maj.page || maj.url })} className="h-6 rounded-md px-2 text-[12px] text-shell-muted hover:bg-shell-hover hover:text-shell-foreground">
                  {t('Nouveautés')}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
