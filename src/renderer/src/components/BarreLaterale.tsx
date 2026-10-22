import * as React from 'react';
import { ArrowLeft, ArrowRight, Lock, Plus, RotateCw, X } from 'lucide-react';
import { agir, useCommande, useEtat, useNav } from '@/etat';
import { aplatir, type Ligne } from '@/lib/aplatir';
import { decouperAdresse } from '@/lib/adresse';
import { cn } from '@/lib/utils';
import { HAUTEUR_LIGNE, LigneOnglet } from './LigneOnglet';
import { LigneDossier } from './LigneDossier';
import { SelecteurEspaces, EnTeteEspace } from './SelecteurEspaces';

const MARGE_RENDU = 8; // lignes rendues au-delà de la zone visible

function BoutonNav({ titre, desactive, onClick, children }: { titre: string; desactive?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={titre}
      disabled={desactive}
      onClick={onClick}
      className="no-drag grid size-7 place-items-center rounded-md text-shell-muted transition-colors hover:bg-shell-hover hover:text-shell-foreground disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Adresse({ ouvrir }: { ouvrir: () => void }) {
  const nav = useNav();
  const actif = useEtat((e) => e.ongletActif);
  const url = nav && nav.id === actif ? nav.url : '';
  const { avant, domaine, securise } = decouperAdresse(url);
  return (
    <button
      onClick={ouvrir}
      title={url}
      className="no-drag mx-2 flex h-8 items-center gap-1.5 rounded-lg bg-shell-input px-2.5 text-left text-[12.5px] transition-colors hover:bg-shell-active"
    >
      {url && !securise && <span className="shrink-0 text-[11px] font-medium text-shell-muted">http</span>}
      {url && securise && <Lock className="size-3 shrink-0 text-shell-muted" aria-label="Connexion sécurisée" />}
      <span className="min-w-0 flex-1 truncate">
        {url ? (
          <>
            <span className="text-shell-muted">{avant}</span>
            <span className="text-shell-foreground">{domaine}</span>
          </>
        ) : (
          <span className="text-shell-muted">Rechercher ou saisir une adresse</span>
        )}
      </span>
    </button>
  );
}

/** La liste virtualisée : seules les lignes visibles (plus une marge) existent dans le DOM. */
function Liste({ lignes, enRenommage, finRenommage, nouvelOnglet }: {
  lignes: Ligne[]; enRenommage: string | null; finRenommage: () => void; nouvelOnglet: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [vue, setVue] = React.useState({ haut: 0, hauteur: 800 });
  React.useLayoutEffect(() => {
    const el = ref.current!;
    const mesurer = () => setVue({ haut: el.scrollTop, hauteur: el.clientHeight });
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    el.addEventListener('scroll', mesurer, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', mesurer);
    };
  }, []);

  const debut = Math.max(0, Math.floor(vue.haut / HAUTEUR_LIGNE) - MARGE_RENDU);
  const fin = Math.min(lignes.length, Math.ceil((vue.haut + vue.hauteur) / HAUTEUR_LIGNE) + MARGE_RENDU);

  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
      <div className="relative" style={{ height: lignes.length * HAUTEUR_LIGNE }}>
        {lignes.slice(debut, fin).map((l, i) => (
          <div key={l.id} className="absolute inset-x-0" style={{ top: (debut + i) * HAUTEUR_LIGNE, height: HAUTEUR_LIGNE }}>
            {l.type === 'onglet' && <LigneOnglet id={l.id} profondeur={l.profondeur} />}
            {l.type === 'dossier' && (
              <LigneDossier id={l.id} profondeur={l.profondeur} enRenommage={enRenommage === l.id} finRenommage={finRenommage} />
            )}
            {l.type === 'separateur' && (
              <button
                onClick={nouvelOnglet}
                className="flex h-full w-full items-center gap-2 rounded-md px-2 text-[13px] text-shell-muted transition-colors hover:bg-shell-hover hover:text-shell-foreground"
              >
                <Plus className="size-4" />
                Nouvel onglet
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const BarreLaterale = React.memo(function BarreLaterale({ ouvrirCommande }: { ouvrirCommande: (nouvelOnglet: boolean) => void }) {
  const mac = window.escale.plateforme === 'darwin';
  const nav = useNav();
  const espaceActif = useEtat((e) => e.espaceActif);
  const partition = useEtat((e) => e.espaces.find((x) => x.id === e.espaceActif)?.partition);
  // Re-calculée seulement quand onglets, dossiers ou espace changent.
  const onglets = useEtat((e) => e.onglets);
  const dossiers = useEtat((e) => e.dossiers);
  const lignes = React.useMemo(
    () => aplatir({ onglets, dossiers } as Parameters<typeof aplatir>[0], espaceActif),
    [onglets, dossiers, espaceActif]
  );
  const [enRenommage, setEnRenommage] = React.useState<string | null>(null);
  useCommande((nom, id) => {
    if (nom === 'renommer' && id) setEnRenommage(id);
  });

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col">
      <div className={cn('drag flex h-[52px] shrink-0 items-center justify-end gap-0.5 pr-2', mac && 'pl-[86px]')}>
        <BoutonNav titre="Précédent" desactive={!nav?.peutReculer} onClick={() => agir('nav.precedent')}>
          <ArrowLeft className="size-4" />
        </BoutonNav>
        <BoutonNav titre="Suivant" desactive={!nav?.peutAvancer} onClick={() => agir('nav.suivant')}>
          <ArrowRight className="size-4" />
        </BoutonNav>
        <BoutonNav titre={nav?.chargement ? 'Arrêter' : 'Recharger'} onClick={() => agir(nav?.chargement ? 'nav.arreter' : 'nav.recharger')}>
          {nav?.chargement ? <X className="size-4" /> : <RotateCw className="size-3.5" />}
        </BoutonNav>
      </div>
      <Adresse ouvrir={() => ouvrirCommande(false)} />
      {partition && (
        <div className="no-drag mx-2 mt-1.5 flex min-h-0 items-center">
          <browser-action-list partition={partition} alignment="bottom right" />
        </div>
      )}
      <EnTeteEspace />
      <Liste lignes={lignes} enRenommage={enRenommage} finRenommage={() => setEnRenommage(null)} nouvelOnglet={() => ouvrirCommande(true)} />
      <SelecteurEspaces />
    </aside>
  );
});
