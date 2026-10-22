import * as React from 'react';
import { AnimatePresence } from 'motion/react';
import { agir, demarrer, lireEtat, useCommande, useEtat, useEtatPret, useQuestion } from './etat';
import { teintes, useSyncedTheme } from './lib/theme';
import { BarreLaterale } from './components/BarreLaterale';
import { TransitionPage } from './components/TransitionPage';
import { BarreCommande } from './components/BarreCommande';
import { BarreRecherche } from './components/BarreRecherche';
import { Reglages } from './components/Reglages';
import { Nouveautes } from './components/Nouveautes';
import { Dialogue } from './components/Dialogue';
import { setLanguage } from './lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Le shell : la barre latérale à gauche, la page encadrée à droite. La page
 * est une vue native posée par le process principal sur `#zone-page`, dont on
 * lui envoie la géométrie à chaque changement.
 */
type Commande = { nouvelOnglet: boolean; depuis?: number } | null;

type Modale = { type: 'reglages' } | { type: 'nouveautes'; version: string; points: string[] } | null;

function ZonePage({ commande, fermerCommande, recherche, fermerRecherche, modale, fermerModale }: {
  commande: Commande; fermerCommande: () => void; recherche: boolean; fermerRecherche: () => void; modale: Modale; fermerModale: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const question = useQuestion();
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
  // Hors macOS, le haut laisse la place aux boutons de la fenêtre (36 px, cf.
  // HAUTEUR_BOUTONS dans le principal) et sert de poignée de déplacement.
  const mac = window.escale.plateforme === 'darwin';
  return (
    <main className={cn('relative flex min-w-0 flex-1 flex-col p-2 pl-0', !mac && 'pt-0')}>
      {!mac && <div className="drag h-9 w-full shrink-0" />}
      <div className="flex min-h-0 w-full flex-1 flex-col rounded-[11px] border border-shell-border bg-shell-raised p-px">
        <AnimatePresence>{recherche && <BarreRecherche fermer={fermerRecherche} />}</AnimatePresence>
        <div ref={ref} id="zone-page" className="relative min-h-0 w-full flex-1 rounded-[10px]">
          <TransitionPage />
          {/* Une question en attente passe devant tout ; ce qu'elle masque revient après. */}
          {question && <Dialogue key={question.id} question={question} />}
          {!question && commande && <BarreCommande nouvelOnglet={commande.nouvelOnglet} depuis={commande.depuis} fermer={fermerCommande} />}
          {!question && !commande && modale?.type === 'reglages' && <Reglages fermer={fermerModale} />}
          {!question && !commande && modale?.type === 'nouveautes' && <Nouveautes version={modale.version} points={modale.points} fermer={fermerModale} />}
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
  const [modale, setModale] = React.useState<Modale>(null);
  // « Nouveautés » une fois par nouvelle version installée.
  React.useEffect(() => {
    (async () => {
      const { version } = (await agir('app.infos')) as { version: string };
      if (lireReglages().derniereVersionVue === version) return;
      const notes = (await agir('maj.notes')) as { points?: string[] } | null;
      if (notes?.points?.length) setModale({ type: 'nouveautes', version, points: notes.points });
      else agir('reglages.modifier', { derniereVersionVue: version });
    })();
  }, []);
  useCommande((nom, _id, t) => {
    if (nom === 'reglages') setModale({ type: 'reglages' });
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
        modale={modale}
        fermerModale={() => setModale(null)}
      />
    </div>
  );
}

const lireReglages = () => lireEtat().reglages;

export default function App() {
  const pret = useEtatPret();
  const langue = useEtat((e) => e?.reglages.langue);
  React.useEffect(() => {
    demarrer();
  }, []);
  if (!pret) return null;
  // La langue avant le rendu ; changer de langue remonte le shell entier.
  setLanguage(langue);
  return <Shell key={langue} />;
}
