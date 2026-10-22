import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Plus } from 'lucide-react';
import { agir, lireEtat } from '@/etat';
import type { Ligne } from '@/lib/aplatir';
import { cibleDepot, sansElement } from '@/lib/depot';
import { useMouvement } from '@/lib/ressorts';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { HAUTEUR_LIGNE, LigneOnglet } from './LigneOnglet';
import { LigneDossier } from './LigneDossier';

const MARGE_RENDU = 8;
const SEUIL_GLISSER = 4; // px avant de considérer un glisser
const ATTENTE_DOSSIER = 400; // ms au-dessus d'un dossier pour y entrer
const CASCADE = 0.02; // s entre deux enfants qui apparaissent
const CASCADE_MAX = 5;

type Glisse = {
  id: string;
  type: 'onglet' | 'dossier';
  prise: number; // décalage du pointeur dans la ligne
  y: number; // position du pointeur dans la liste
  dossierCible: string | null;
};

export function Liste({ lignes, enRenommage, finRenommage, nouvelOnglet, rail }: {
  lignes: Ligne[]; enRenommage: string | null; finRenommage: () => void; nouvelOnglet: () => void; rail: boolean;
}) {
  const transition = useMouvement();
  const reduit = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const [vue, setVue] = React.useState({ haut: 0, hauteur: 800 });
  const [glisse, setGlisse] = React.useState<Glisse | null>(null);
  const glisseRef = React.useRef<Glisse | null>(null);
  glisseRef.current = glisse;

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

  // Les lignes apparues depuis le rendu précédent : elles seules s'animent en
  // entrant (celles qui entrent par le défilement arrivent sans effet), en
  // cascade quand un dossier se déplie.
  const precedentes = React.useRef(new Set(lignes.map((l) => l.id)));
  const nouvelles = new Map<string, number>();
  for (const l of lignes) if (!precedentes.current.has(l.id)) nouvelles.set(l.id, Math.min(nouvelles.size, CASCADE_MAX) * CASCADE);
  React.useEffect(() => {
    precedentes.current = new Set(lignes.map((l) => l.id));
  });
  const presentes = React.useMemo(() => new Set(lignes.map((l) => l.id)), [lignes]);

  // Pendant un glisser : l'élément sort de la liste, et un interstice s'ouvre
  // là où il tomberait ; les voisines s'écartent d'elles-mêmes (leur y change).
  const base = glisse ? sansElement(lignes, glisse.id) : lignes;
  const interstice = glisse ? Math.max(0, Math.min(base.length, Math.round((glisse.y - glisse.prise) / HAUTEUR_LIGNE))) : -1;
  const positions = base.map((l, i) => ({ l, top: (glisse && !glisse.dossierCible && i >= interstice ? i + 1 : i) * HAUTEUR_LIGNE }));

  const total = base.length + (glisse ? 1 : 0);
  const debut = Math.max(0, Math.floor(vue.haut / HAUTEUR_LIGNE) - MARGE_RENDU);
  const fin = Math.ceil((vue.haut + vue.hauteur) / HAUTEUR_LIGNE) + MARGE_RENDU;
  const visibles = positions.filter((p) => p.top / HAUTEUR_LIGNE >= debut && p.top / HAUTEUR_LIGNE <= fin);

  // ---- glisser-déposer ----
  const depart = React.useRef<{ id: string; type: 'onglet' | 'dossier'; x: number; y: number; prise: number } | null>(null);
  const avale = React.useRef(false); // le clic qui suit un glisser ne doit pas activer l'onglet
  const minuteurDossier = React.useRef<number>(0);

  const yDansListe = (clientY: number) => clientY - ref.current!.getBoundingClientRect().top + ref.current!.scrollTop;

  const surPointerDown = (e: React.PointerEvent, l: Ligne) => {
    if (rail || e.button !== 0 || l.type === 'separateur' || (e.target as HTMLElement).closest('button,input')) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    depart.current = { id: l.id, type: l.type, x: e.clientX, y: e.clientY, prise: e.clientY - rect.top };
  };

  React.useEffect(() => {
    const deplacer = (e: PointerEvent) => {
      const d = depart.current;
      if (!d) return;
      const g = glisseRef.current;
      if (!g) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < SEUIL_GLISSER) return;
        avale.current = true;
        setGlisse({ id: d.id, type: d.type, prise: d.prise, y: yDansListe(e.clientY), dossierCible: null });
        return;
      }
      const y = yDansListe(e.clientY);
      // Au-dessus du milieu d'un dossier assez longtemps : on y entre.
      const sous = sansElement(lignes, g.id)[Math.floor(y / HAUTEUR_LIGNE)];
      const milieu = Math.abs((y % HAUTEUR_LIGNE) - HAUTEUR_LIGNE / 2) < HAUTEUR_LIGNE / 4;
      window.clearTimeout(minuteurDossier.current);
      if (sous?.type === 'dossier' && milieu && sous.id !== g.id) {
        minuteurDossier.current = window.setTimeout(
          () => setGlisse((x) => (x ? { ...x, dossierCible: sous.id } : x)),
          ATTENTE_DOSSIER
        );
        setGlisse({ ...g, y });
      } else setGlisse({ ...g, y, dossierCible: null });
    };
    const lacher = () => {
      window.clearTimeout(minuteurDossier.current);
      const g = glisseRef.current;
      depart.current = null;
      if (!g) return;
      setGlisse(null);
      const etat = lireEtat();
      const sans = sansElement(lignes, g.id);
      const cible = g.dossierCible
        ? { dossierId: g.dossierCible, apres: null, avant: null, epingle: true }
        : cibleDepot(sans, etat, g.type, Math.max(0, Math.min(sans.length, Math.round((g.y - g.prise) / HAUTEUR_LIGNE))));
      if (!cible) return;
      const { dossierId, apres, avant, epingle } = cible;
      const charge = g.type === 'dossier' ? { id: g.id, type: g.type, dossierId, apres, avant } : { id: g.id, type: g.type, dossierId, apres, avant, epingle };
      agir('onglet.deplacer', charge).catch(() => {});
    };
    const annuler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !glisseRef.current) return;
      depart.current = null;
      setGlisse(null);
    };
    window.addEventListener('pointermove', deplacer);
    window.addEventListener('pointerup', lacher);
    window.addEventListener('keydown', annuler);
    return () => {
      window.removeEventListener('pointermove', deplacer);
      window.removeEventListener('pointerup', lacher);
      window.removeEventListener('keydown', annuler);
    };
  }, [lignes]);

  const surClicCapture = (e: React.MouseEvent) => {
    if (avale.current) {
      avale.current = false;
      e.stopPropagation();
    }
  };

  const ligneDe = (l: Ligne) =>
    l.type === 'onglet' ? (
      <LigneOnglet id={l.id} profondeur={rail ? 0 : l.profondeur} rail={rail} />
    ) : l.type === 'dossier' ? (
      <LigneDossier id={l.id} profondeur={l.profondeur} enRenommage={enRenommage === l.id} finRenommage={finRenommage} rail={rail} />
    ) : (
      <button
        onClick={nouvelOnglet}
        title={t('Nouvel onglet')}
        className={cn(
          'flex h-full w-full items-center gap-2 rounded-md text-[13px] text-shell-muted transition-colors duration-100 hover:bg-shell-hover hover:text-shell-foreground',
          rail ? 'justify-center' : 'px-2'
        )}
      >
        <Plus className="size-4 shrink-0" />
        {!rail && t('Nouvel onglet')}
      </button>
    );

  const sortie = (id: string) => (presentes.has(id) ? { opacity: 1, transition: { duration: 0 } } : { opacity: 0, scaleY: 0.6, transition });

  return (
    <div ref={ref} onClickCapture={surClicCapture} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2">
      <div className="relative" style={{ height: total * HAUTEUR_LIGNE }}>
        <AnimatePresence initial={false}>
          {visibles.map(({ l, top }) => (
            <motion.div
              key={l.id}
              onPointerDown={(e) => surPointerDown(e, l)}
              className={cn('absolute inset-x-0 top-0 origin-top', glisse?.dossierCible === l.id && 'rounded-md ring-2 ring-accent-escale/60')}
              style={{ height: HAUTEUR_LIGNE }}
              initial={nouvelles.has(l.id) && !reduit ? { opacity: 0, scaleY: 0.6, y: top } : false}
              animate={{ opacity: 1, scaleY: 1, y: top, transition: { ...transition, delay: nouvelles.get(l.id) ?? 0 } }}
              exit={sortie(l.id)}
            >
              {ligneDe(l)}
            </motion.div>
          ))}
        </AnimatePresence>
        {glisse && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 rounded-md bg-shell-raised opacity-95 shadow-[0_1px_0_var(--shell-border),0_8px_24px_-12px_rgb(0_0_0/0.35)]"
            style={{ height: HAUTEUR_LIGNE }}
            initial={false}
            animate={{ y: glisse.y - glisse.prise }}
            transition={{ type: 'spring', stiffness: 900, damping: 60 }}
          >
            {ligneDe(lignes.find((l) => l.id === glisse.id) || { type: 'onglet', id: glisse.id, profondeur: 0 })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
