import * as React from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import { agir, useEtat, useVivant } from '@/etat';
import { cn } from '@/lib/utils';
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

export const LigneOnglet = React.memo(function LigneOnglet({ id, profondeur }: { id: string; profondeur: number }) {
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
      title={`${nom}\n${onglet.url}`}
      onClick={() => agir('onglet.activer', { id })}
      onAuxClick={(e) => e.button === 1 && agir('onglet.fermer', { id })}
      onKeyDown={(e) => e.key === 'Enter' && agir('onglet.activer', { id })}
      onContextMenu={(e) => {
        e.preventDefault();
        agir('menu.onglet', { id });
      }}
      style={{ height: HAUTEUR_LIGNE, paddingLeft: 8 + profondeur * RETRAIT }}
      className={cn(
        'group relative flex items-center gap-2 rounded-md pr-1.5 outline-none select-none',
        'focus-visible:ring-2 focus-visible:ring-accent-escale/60',
        actif ? 'bg-shell-raised shadow-[0_0_0_1px_var(--shell-border)]' : 'hover:bg-shell-hover'
      )}
    >
      <Favicon src={onglet.favicon} url={onglet.url} className={cn(endormi && 'opacity-60')} />
      <span className={cn('min-w-0 flex-1 truncate text-[13px]', endormi && !actif && 'text-shell-muted')}>{nom}</span>
      {(vivant?.son || onglet.muet) && (
        <button
          title={onglet.muet ? 'Rétablir le son' : 'Couper le son'}
          onClick={(e) => {
            e.stopPropagation();
            agir('onglet.muet', { id, oui: !onglet.muet });
          }}
          className="shrink-0 rounded p-0.5 text-shell-muted hover:text-shell-foreground"
        >
          {onglet.muet ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </button>
      )}
      <button
        title="Fermer l’onglet"
        onClick={(e) => {
          e.stopPropagation();
          agir('onglet.fermer', { id });
        }}
        className="shrink-0 rounded p-0.5 text-shell-muted opacity-0 group-hover:opacity-100 hover:bg-shell-active hover:text-shell-foreground focus-visible:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
});
