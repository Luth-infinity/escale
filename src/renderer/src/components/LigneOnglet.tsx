import * as React from 'react';
import { motion } from 'motion/react';
import { Volume2, VolumeX, X } from 'lucide-react';
import { agir, useEtat, useVivant } from '@/etat';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { useMouvement } from '@/lib/ressorts';
import { Favicon } from './Favicon';

export const HAUTEUR_LIGNE = 32;
const RETRAIT = 14;

function libelle(titre: string, url: string) {
  if (titre) return titre;
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

export const LigneOnglet = React.memo(function LigneOnglet({ id, profondeur, rail = false }: { id: string; profondeur: number; rail?: boolean }) {
  const transition = useMouvement();
  const onglet = useEtat((e) => e.onglets.find((o) => o.id === id));
  const actif = useEtat((e) => e.ongletActif === id);
  const vivant = useVivant(id);
  if (!onglet) return null;
  const nom = libelle(onglet.titre, onglet.url);
  const endormi = vivant ? !vivant.vivant : !actif;
  return (
    <div
      role="button"
      tabIndex={0}
      data-id={id}
      title={`${nom}\n${onglet.url}`}
      onClick={() => agir('onglet.activer', { id })}
      onAuxClick={(e) => e.button === 1 && agir('onglet.fermer', { id })}
      onKeyDown={(e) => e.key === 'Enter' && agir('onglet.activer', { id })}
      onContextMenu={(e) => {
        e.preventDefault();
        agir('menu.onglet', { id });
      }}
      style={{ height: HAUTEUR_LIGNE, paddingLeft: rail ? 0 : 8 + profondeur * RETRAIT }}
      className={cn(
        'group relative flex items-center gap-2 rounded-md outline-none select-none transition-colors duration-100',
        'focus-visible:ring-2 focus-visible:ring-accent-escale/60',
        rail ? 'justify-center' : 'pr-1.5',
        !actif && 'hover:bg-shell-hover'
      )}
    >
      {actif && (
        // Le fond de sélection glisse d'une ligne à l'autre au lieu de sauter.
        <motion.div
          layoutId="fond-actif"
          transition={transition}
          className="absolute inset-0 rounded-md bg-shell-raised shadow-[0_0_0_1px_var(--shell-border)]"
        />
      )}
      <Favicon src={onglet.favicon} url={onglet.url} className={cn('relative', endormi && 'opacity-60')} />
      {!rail && (
        <>
      <span className={cn('relative min-w-0 flex-1 truncate text-[13px]', endormi && !actif && 'text-shell-muted')}>{nom}</span>
      {(vivant?.son || onglet.muet) && (
        <button
          title={onglet.muet ? t('Rétablir le son') : t('Couper le son')}
          onClick={(e) => {
            e.stopPropagation();
            agir('onglet.muet', { id, oui: !onglet.muet });
          }}
          className="relative shrink-0 rounded p-0.5 text-shell-muted hover:text-shell-foreground"
        >
          {onglet.muet ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </button>
      )}
      <button
        title={t("Fermer l'onglet")}
        onClick={(e) => {
          e.stopPropagation();
          agir('onglet.fermer', { id });
        }}
        className="relative shrink-0 rounded p-0.5 text-shell-muted opacity-0 transition-opacity duration-100 group-hover:opacity-100 hover:bg-shell-active hover:text-shell-foreground focus-visible:opacity-100"
      >
        <X className="size-3.5" />
      </button>
        </>
      )}
    </div>
  );
});
