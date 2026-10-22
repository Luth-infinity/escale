import * as React from 'react';
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react';
import { ArrowLeft, ArrowRight, Lock, RotateCw, X } from 'lucide-react';
import { agir, useCommande, useEtat, useNav } from '@/etat';
import { aplatir } from '@/lib/aplatir';
import { decouperAdresse } from '@/lib/adresse';
import { RESSORT, useMouvement } from '@/lib/ressorts';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { Liste } from './Liste';
import { SelecteurEspaces, EnTeteEspace } from './SelecteurEspaces';
import { BandeauMaj } from './BandeauMaj';
import { Logo } from './Logo';
import { TelechargementsVideo } from './YouTube';

export const LARGEUR = 240;
export const LARGEUR_RAIL = 56;
const SEUIL_BALAYAGE = 70; // px de balayage horizontal pour changer d'espace
const FIN_GESTE_MS = 120; // silence de la molette qui marque la fin du geste

function BoutonNav({ titre, desactive, onClick, children }: { titre: string; desactive?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={titre}
      disabled={desactive}
      onClick={onClick}
      className="no-drag grid size-7 place-items-center rounded-md text-shell-muted transition-colors duration-100 hover:bg-shell-hover hover:text-shell-foreground disabled:opacity-35 disabled:hover:bg-transparent"
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
      className="no-drag mx-2 flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-shell-input px-2.5 text-left text-[12.5px] transition-colors duration-100 hover:bg-shell-active"
    >
      {url && !securise && <span className="shrink-0 text-[11px] font-medium text-shell-muted">http</span>}
      {url && securise && <Lock className="size-3 shrink-0 text-shell-muted" aria-label={t('Connexion sécurisée')} />}
      <span className="min-w-0 flex-1 truncate">
        {url ? (
          <>
            <span className="text-shell-muted">{avant}</span>
            <span className="text-shell-foreground">{domaine}</span>
          </>
        ) : (
          <span className="text-shell-muted">{t('Rechercher ou saisir une adresse')}</span>
        )}
      </span>
    </button>
  );
}

export const BarreLaterale = React.memo(function BarreLaterale({ ouvrirCommande }: { ouvrirCommande: (nouvelOnglet: boolean) => void }) {
  const mac = window.escale.plateforme === 'darwin';
  const transition = useMouvement();
  const nav = useNav();
  const rail = useEtat((e) => e.reglages.barreRepliee);
  const espaces = useEtat((e) => e.espaces);
  const espaceActif = useEtat((e) => e.espaceActif);
  const onglets = useEtat((e) => e.onglets);
  const dossiers = useEtat((e) => e.dossiers);
  const lignes = React.useMemo(
    () => aplatir({ onglets, dossiers } as Parameters<typeof aplatir>[0], espaceActif),
    [onglets, dossiers, espaceActif]
  );
  const [enRenommage, setEnRenommage] = React.useState<string | null>(null);
  useCommande((nom, id) => {
    if (nom === 'renommer' && id) setEnRenommage(id);
    if (nom === 'replier') agir('barre.replier', { oui: !rail });
  });

  // ---- changer d'espace en balayant à deux doigts ----
  const x = useMotionValue(0);
  const cumul = React.useRef(0);
  const finGeste = React.useRef(0);
  const [sens, setSens] = React.useState(0);
  const indexActif = espaces.findIndex((e) => e.id === espaceActif);
  const surMolette = (e: React.WheelEvent) => {
    if (rail || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    cumul.current -= e.deltaX;
    // La liste suit le doigt, freinée au-delà du seuil et aux extrémités.
    const voisin = espaces[indexActif + (cumul.current < 0 ? 1 : -1)];
    const frein = voisin ? 0.55 : 0.2;
    x.set(Math.max(-120, Math.min(120, cumul.current * frein)));
    window.clearTimeout(finGeste.current);
    finGeste.current = window.setTimeout(() => {
      const d = cumul.current < -SEUIL_BALAYAGE ? 1 : cumul.current > SEUIL_BALAYAGE ? -1 : 0;
      cumul.current = 0;
      const cible = espaces[indexActif + d];
      if (d && cible) {
        setSens(d);
        x.set(0);
        agir('espace.activer', { id: cible.id });
      } else animate(x, 0, RESSORT);
    }, FIN_GESTE_MS);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: rail ? LARGEUR_RAIL : LARGEUR }}
      transition={transition}
      onWheel={surMolette}
      className="flex h-full shrink-0 flex-col overflow-hidden"
    >
      <div className={cn('drag flex h-[52px] shrink-0 items-center gap-0.5 pr-2', mac && !rail && 'pl-[86px]', rail && 'justify-center pr-0')}>
        {/* Hors macOS, pas de feux à gauche : la place revient au logo. */}
        {!mac && (
          <div className={cn('flex min-w-0 items-center gap-2', !rail && 'mr-auto pl-3')}>
            <Logo className="size-5 shrink-0" />
            {!rail && <span className="truncate text-[13px] font-semibold tracking-tight">Escale</span>}
          </div>
        )}
        {mac && !rail && <span className="mr-auto" />}
        {!rail && (
          <>
            <BoutonNav titre={t('Précédent')} desactive={!nav?.peutReculer} onClick={() => agir('nav.precedent')}>
              <ArrowLeft className="size-4" />
            </BoutonNav>
            <BoutonNav titre={t('Suivant')} desactive={!nav?.peutAvancer} onClick={() => agir('nav.suivant')}>
              <ArrowRight className="size-4" />
            </BoutonNav>
            <BoutonNav titre={nav?.chargement ? t('Arrêter') : t('Recharger')} onClick={() => agir(nav?.chargement ? 'nav.arreter' : 'nav.recharger')}>
              {nav?.chargement ? <X className="size-4" /> : <RotateCw className="size-3.5" />}
            </BoutonNav>
          </>
        )}
      </div>
      {!rail && <Adresse ouvrir={() => ouvrirCommande(false)} />}
      <div className="relative min-h-0 flex-1">
        <AnimatePresence initial={false} custom={sens} mode="popLayout">
          <motion.div
            key={espaceActif}
            custom={sens}
            variants={{
              entree: (s: number) => ({ x: s * 48, opacity: 0 }),
              centre: { x: 0, opacity: 1 },
              sortie: (s: number) => ({ x: s * -48, opacity: 0 })
            }}
            initial="entree"
            animate="centre"
            exit="sortie"
            transition={transition}
            className="absolute inset-0 flex flex-col"
          >
            <motion.div style={{ x }} className="flex min-h-0 flex-1 flex-col">
              {!rail && <EnTeteEspace />}
              <Liste
                lignes={lignes}
                enRenommage={enRenommage}
                finRenommage={() => setEnRenommage(null)}
                nouvelOnglet={() => ouvrirCommande(true)}
                rail={rail}
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
      <TelechargementsVideo rail={rail} />
      <BandeauMaj rail={rail} />
      <SelecteurEspaces rail={rail} />
    </motion.aside>
  );
});
