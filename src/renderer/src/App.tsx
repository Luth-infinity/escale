import * as React from 'react';
import { agir, demarrer, useCommande, useEtat, useEtatPret } from './etat';
import { teintes, useSyncedTheme } from './lib/theme';
import { BarreLaterale } from './components/BarreLaterale';

/**
 * Le shell : la barre latérale à gauche, la page encadrée à droite. La page
 * est une vue native posée par le process principal sur `#zone-page`, dont on
 * lui envoie la géométrie à chaque changement.
 */
function ZonePage() {
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
      <div className="h-full w-full rounded-[11px] border border-shell-border bg-shell-raised p-px">
        <div ref={ref} id="zone-page" className="h-full w-full rounded-[10px]" />
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
    if (t) {
      racine.setProperty('--tint-surface', t.surface);
      racine.setProperty('--tint-line', t.line);
    } else {
      racine.removeProperty('--tint-surface');
      racine.removeProperty('--tint-line');
    }
  }, [teinte, sombre]);
}

function Shell() {
  const sombre = useSyncedTheme();
  useTeinteEspace(sombre);
  const [commande, setCommande] = React.useState<null | { nouvelOnglet: boolean }>(null);
  useCommande((nom) => {
    if (nom === 'nouvel-onglet') setCommande({ nouvelOnglet: true });
    if (nom === 'adresse') setCommande({ nouvelOnglet: false });
  });
  const ouvrirCommande = React.useCallback((nouvelOnglet: boolean) => setCommande({ nouvelOnglet }), []);
  void commande;
  return (
    <div className="flex h-full">
      <BarreLaterale ouvrirCommande={ouvrirCommande} />
      <ZonePage />
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
