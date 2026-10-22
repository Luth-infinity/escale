import { FolderOpen, X } from 'lucide-react';
import { agir, oublierVideo, useVideos } from '@/etat';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const pourcent = (recu = 0, total = 0) => (total > 0 ? Math.min(100, Math.round((recu / total) * 100)) : null);

/** Les téléchargements de vidéos, en bas de la barre, jusqu'à ce qu'on les ferme. */
export function TelechargementsVideo({ rail }: { rail: boolean }) {
  const videos = useVideos();
  if (rail || videos.length === 0) return null;
  return (
    <div className="mx-2 mb-2 flex shrink-0 flex-col gap-1.5">
      {videos.map((v) => {
        const p = pourcent(v.recu, v.total);
        const enCours = v.etat === 'prepare' || v.etat === 'en-cours';
        return (
          <div key={v.id} className="rounded-lg border border-shell-border bg-shell-raised px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium" title={v.nom}>{v.nom}</span>
              {v.etat === 'fini' && (
                <button title={t('Afficher dans le dossier')} onClick={() => agir('video.montrer', { id: v.id })} className="grid size-5 place-items-center rounded text-shell-muted hover:text-shell-foreground">
                  <FolderOpen className="size-3.5" />
                </button>
              )}
              <button
                title={enCours ? t('Annuler') : t('Fermer')}
                onClick={() => (enCours ? agir('video.annuler', { id: v.id }) : oublierVideo(v.id))}
                className="grid size-5 place-items-center rounded text-shell-muted hover:text-shell-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="mt-1 text-[11.5px] text-shell-muted">
              {v.etat === 'prepare' && (v.detail || t('Préparation…'))}
              {v.etat === 'en-cours' && (p === null ? t('Téléchargement…') : t('Téléchargement · {p} %', { p }))}
              {v.etat === 'fini' && t('Terminé · dans Téléchargements')}
              {v.etat === 'echec' && <span className="text-red-500">{v.erreur || t('Le téléchargement a échoué')}</span>}
            </div>
            {enCours && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-shell-active">
                <div className={cn('h-full rounded-full bg-accent-escale transition-[width] duration-300', p === null && 'w-1/3 animate-pulse')} style={p === null ? undefined : { width: `${p}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
