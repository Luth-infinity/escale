import * as React from 'react';
import { motion } from 'motion/react';
import { Search, X } from 'lucide-react';
import { agir } from '@/etat';
import { t } from '@/lib/i18n';
import { useModalePage } from '@/lib/modale';
import { useMouvement } from '@/lib/ressorts';

type Visite = { url: string; titre: string; quand?: number; derniere?: number };

const hote = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

function jourDe(quand: number) {
  const d = new Date(quand);
  const aujourdhui = new Date();
  const hier = new Date(Date.now() - 86400e3);
  const meme = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (meme(d, aujourdhui)) return t('Aujourd’hui');
  if (meme(d, hier)) return t('Hier');
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** L'historique (Ctrl+H) : par jour, du plus récent au plus ancien, avec recherche. */
export function Historique({ fermer }: { fermer: () => void }) {
  const transition = useMouvement();
  const fond = useModalePage();
  const [visites, setVisites] = React.useState<Visite[]>([]);
  const [recherche, setRecherche] = React.useState('');
  const [fin, setFin] = React.useState(false);
  const champ = React.useRef<HTMLInputElement>(null);

  const charger = React.useCallback(async (avant?: number) => {
    const lot = (await agir('historique.recents', avant ? { avant } : {})) as Visite[];
    setVisites((v) => (avant ? [...v, ...lot] : lot));
    setFin(lot.length < 100);
  }, []);

  React.useEffect(() => {
    champ.current?.focus();
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && fermer();
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [fermer]);

  React.useEffect(() => {
    const texte = recherche.trim();
    if (!texte) {
      charger();
      return;
    }
    let vivant = true;
    const minuteur = setTimeout(async () => {
      const r = (await agir('historique.chercher', { texte })) as Visite[];
      if (vivant) {
        setVisites(r.map((x) => ({ ...x, quand: x.derniere })));
        setFin(true);
      }
    }, 120);
    return () => {
      vivant = false;
      clearTimeout(minuteur);
    };
  }, [recherche, charger]);

  const ouvrir = (url: string) => {
    agir('onglet.ouvrir', { url });
    fermer();
  };
  const oublier = async (url: string) => {
    await agir('historique.oublier', { url });
    setVisites((v) => v.filter((x) => x.url !== url));
  };

  // Regroupées par jour, dans l'ordre reçu.
  const jours: [string, Visite[]][] = [];
  for (const v of visites) {
    const j = jourDe(v.quand || 0);
    const dernier = jours[jours.length - 1];
    if (dernier && dernier[0] === j) dernier[1].push(v);
    else jours.push([j, [v]]);
  }

  return (
    <div className="absolute inset-0 z-20" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      {fond && <img src={fond} alt="" className="pointer-events-none absolute inset-0 size-full rounded-(--rayon-page) object-cover" />}
      <motion.div className="pointer-events-none absolute inset-0 rounded-(--rayon-page) bg-black/10 dark:bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} />
      <motion.div
        role="dialog"
        aria-label={t('Historique')}
        initial={{ opacity: 0, scale: 0.98, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={transition}
        className="absolute top-[7%] left-1/2 flex max-h-[86%] w-[min(620px,calc(100%-48px))] -translate-x-1/2 flex-col rounded-xl border border-shell-border bg-shell-raised shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)]"
      >
        <div className="flex items-center gap-2 border-b border-shell-border px-4 py-3">
          <Search className="size-4 shrink-0 text-shell-muted" />
          <input
            ref={champ}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('Rechercher dans l’historique')}
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-shell-muted"
          />
          <button onClick={fermer} title={t('Fermer')} className="grid size-7 place-items-center rounded-md text-shell-muted hover:bg-shell-hover">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {visites.length === 0 && (
            <div className="px-3 py-10 text-center text-[13px] text-shell-muted">{recherche ? t('Rien trouvé.') : t('Aucune page visitée pour l’instant.')}</div>
          )}
          {jours.map(([jour, liste]) => (
            <div key={jour} className="mb-2">
              <div className="sticky top-0 bg-shell-raised px-3 pt-2 pb-1 text-[11.5px] font-semibold text-shell-muted first-letter:uppercase">{jour}</div>
              {liste.map((v, i) => (
                <div key={`${v.url}-${v.quand}-${i}`} className="group flex items-center gap-3 rounded-lg px-3 py-1.5 hover:bg-shell-hover">
                  <span className="w-11 shrink-0 text-[11.5px] tabular-nums text-shell-muted">
                    {v.quand ? new Date(v.quand).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  <button onClick={() => ouvrir(v.url)} className="min-w-0 flex-1 text-left" title={v.url}>
                    <div className="truncate text-[13px]">{v.titre || hote(v.url)}</div>
                    <div className="truncate text-[11.5px] text-shell-muted">{hote(v.url)}</div>
                  </button>
                  <button
                    onClick={() => oublier(v.url)}
                    title={t('Retirer de l’historique')}
                    className="grid size-6 shrink-0 place-items-center rounded text-shell-muted opacity-0 group-hover:opacity-100 hover:text-shell-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ))}
          {!fin && !recherche && visites.length > 0 && (
            <button onClick={() => charger(visites[visites.length - 1].quand)} className="mx-auto my-2 block rounded-md px-3 py-1.5 text-[12.5px] text-shell-muted hover:bg-shell-hover">
              {t('Plus ancien')}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
