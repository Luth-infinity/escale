import * as React from 'react';
import { AnimatePresence } from 'motion/react';
import { agir, demarrer, useCommande, useEtat, useEtatPret } from './etat';
import { teintes, useSyncedTheme } from './lib/theme';
import { BarreLaterale } from './components/BarreLaterale';
import { TransitionPage } from './components/TransitionPage';
import { BarreCommande } from './components/BarreCommande';
import { BarreRecherche } from './components/BarreRecherche';

/**
 * Le shell : la barre latérale à gauche, la page encadrée à droite. La page
 * est une vue native posée par le process principal sur `#zone-page`, dont on
 * lui envoie la géométrie à chaque changement.
 */
type Commande = { nouvelOnglet: boolean; depuis?: number } | null;

function ZonePage({ commande, fermerCommande, recherche, fermerRecherche }: {
  commande: Commande; fermerCommande: () => void; recherche: boolean; fermerRecherche: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current!;
    let frame = 0;
    const envoyer = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        agir('layout.zone', { x: r.x, y: r.y, width: r.width, height: r.height });
      });
    };
    envoyer();
    const ro = new ResizeObserver(envoyer);
    ro.observe(el);
    window.addEventListener('resize', envoyer);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', envoyer);
    };
  }, []);
  // La bordure dessine le cadre ; la vue native est posée dans son rectangle.
  return (
    <main className="relative min-w-0 flex-1 p-2 pl-0">
      <div className="flex h-full w-full flex-col rounded-[11px] border border-shell-border bg-shell-raised p-px">
        <AnimatePresence>{recherche && <BarreRecherche fermer={fermerRecherche} />}</AnimatePresence>
        <div ref={ref} id="zone-page" className="relative min-h-0 w-full flex-1 rounded-[10px]">
          <TransitionPage />
          {commande && <BarreCommande nouvelOnglet={commande.nouvelOnglet} depuis={commande.depuis} fermer={fermerCommande} />}
        </div>
      </div>
    </main>
  );
}

/** La teinte de l'espace actif, très légère, posée sur <html> (piège : pas sur un div). */
function useTeinteEspace(sombre: boolean) {
  const teinte = useEtat((e) => e.espaces.find((x) => x.id === e.espaceActif)?.teinte ?? null);
  React.useEffect(() => {
    const racine = document.documentElement.style;
    const t = teinte ? teintes(teinte, sombre) : null;
    // Toujours posées (base neutre sans teinte) : ce sont des propriétés
    // enregistrées (@property, index.css), qui passent en fondu d'un espace à l'autre.
    racine.setProperty('--tint-surface', t ? t.surface : 'var(--shell-base)');
    racine.setProperty('--tint-line', t ? t.line : 'var(--shell-border-base)');
  }, [teinte, sombre]);
}

function Shell() {
  const sombre = useSyncedTheme();
  useTeinteEspace(sombre);
  const [commande, setCommande] = React.useState<Commande>(null);
  const [recherche, setRecherche] = React.useState(false);
  useCommande((nom, _id, t) => {
    if (nom === 'nouvel-onglet') setCommande({ nouvelOnglet: true, depuis: t });
    if (nom === 'adresse') setCommande({ nouvelOnglet: false, depuis: t });
    if (nom === 'chercher') setRecherche(true);
  });
  const ouvrirCommande = React.useCallback((nouvelOnglet: boolean) => setCommande({ nouvelOnglet, depuis: Date.now() }), []);
  return (
    <div className="flex h-full">
      <BarreLaterale ouvrirCommande={ouvrirCommande} />
      <ZonePage
        commande={commande}
        fermerCommande={() => setCommande(null)}
        recherche={recherche}
        fermerRecherche={() => setRecherche(false)}
      />
    </div>
  );
}

export default function App() {
  const pret = useEtatPret();
  React.useEffect(() => {
    demarrer();
  }, []);
  return pret ? <Shell /> : null;
}
