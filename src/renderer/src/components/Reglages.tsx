import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Globe, History, Info, Keyboard, PanelsTopLeft, Play, Shield, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { agir, commandeLocale, useEtat } from '@/etat';
import { t } from '@/lib/i18n';
import { useModalePage } from '@/lib/modale';
import { useMouvement } from '@/lib/ressorts';
import { cn } from '@/lib/utils';
import type { Reglages as R } from '@/types';
import { Logo } from './Logo';

/*
 * Les réglages : une navigation par thème à gauche, et à droite des cartes de
 * lignes, chacune avec ce qu'elle fait en clair. La section ouverte est
 * retenue d'une ouverture à l'autre.
 */
type Choix<K extends keyof R> = { cle: K; options: [R[K], string][] };

function Segments<K extends keyof R>({ choix, valeur }: { choix: Choix<K>; valeur: R[K] }) {
  const transition = useMouvement();
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-shell-input p-0.5">
      {choix.options.map(([v, libelle]) => (
        <button
          key={String(v)}
          onClick={() => agir('reglages.modifier', { [choix.cle]: v })}
          className={cn('relative rounded-md px-2.5 py-1 text-[12.5px] transition-colors duration-100', v === valeur ? 'text-shell-foreground' : 'text-shell-muted hover:text-shell-foreground')}
        >
          {v === valeur && (
            <motion.span layoutId={`segment-${String(choix.cle)}`} transition={transition} className="absolute inset-0 rounded-md bg-shell-raised shadow-[0_0_0_1px_var(--shell-border)]" />
          )}
          <span className="relative">{t(libelle)}</span>
        </button>
      ))}
    </div>
  );
}

function Interrupteur({ actif, onChange, titre }: { actif: boolean; onChange: (v: boolean) => void; titre: string }) {
  const transition = useMouvement();
  return (
    <button
      role="switch"
      aria-checked={actif}
      aria-label={titre}
      onClick={() => onChange(!actif)}
      className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150', actif ? 'bg-accent-escale' : 'bg-shell-active')}
    >
      <motion.span layout transition={transition} className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow', actif ? 'right-0.5' : 'left-0.5')} />
    </button>
  );
}

const bouton = 'h-7 shrink-0 rounded-lg border border-shell-border px-3 text-[12.5px] font-medium transition-colors hover:bg-shell-hover disabled:opacity-50';

/** Une ligne de réglage : son nom, ce qu'elle fait, et sa commande à droite (ou dessous). */
function Ligne({ titre, detail, children, dessous = false }: { titre: string; detail?: React.ReactNode; children?: React.ReactNode; dessous?: boolean }) {
  return (
    <div className={cn('px-4 py-3', dessous ? 'space-y-2' : 'flex items-center gap-4')}>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{titre}</div>
        {detail && <div className="mt-0.5 text-[12px] leading-snug text-shell-muted">{detail}</div>}
      </div>
      {children}
    </div>
  );
}

function Carte({ titre, children }: { titre?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      {titre && <h3 className="px-1 text-[11.5px] font-semibold tracking-wide text-shell-muted uppercase">{titre}</h3>}
      <div className="divide-y divide-shell-border overflow-hidden rounded-xl border border-shell-border bg-shell-base/40">{children}</div>
    </section>
  );
}

function Bascule({ cle, titre, detail }: { cle: keyof R; titre: string; detail: string }) {
  const valeur = useEtat((e) => e.reglages[cle]) as boolean;
  return (
    <Ligne titre={t(titre)} detail={t(detail)}>
      <Interrupteur actif={valeur} titre={t(titre)} onChange={(v) => agir('reglages.modifier', { [cle]: v })} />
    </Ligne>
  );
}

function Selection<K extends keyof R>({ cle, titre, detail, options }: { cle: K; titre: string; detail?: string; options: [R[K], string][] }) {
  const valeur = useEtat((e) => e.reglages[cle]);
  return (
    <Ligne titre={t(titre)} detail={detail && t(detail)} dessous>
      <Segments choix={{ cle, options }} valeur={valeur} />
    </Ligne>
  );
}

// ---------------------------------------------------------------- Profil

// Les mêmes teintes que le menu du clic droit (menus-contextuels.js).
const TEINTES = ['#3a7f6b', '#3b6fb6', '#6d5bb8', '#b9577c', '#b5523b', '#a9832c', '#5c7a3a', '#5b6472'];
const EMOJIS = ['🏠', '💼', '🎮', '🎨', '📚', '🎧', '✈️', '🛒', '💻', '⚽'];

/** Le profil, c'est l'espace actif : la pastille du bas de la barre porte son initiale, ou son emoji, sur sa couleur. */
function SectionProfil() {
  const espace = useEtat((e) => e.espaces.find((x) => x.id === e.espaceActif));
  const [nom, setNom] = React.useState(espace?.nom ?? '');
  React.useEffect(() => setNom(espace?.nom ?? ''), [espace?.id, espace?.nom]);
  if (!espace) return null;
  const modifier = (patch: Record<string, unknown>) => agir('espace.modifier', { id: espace.id, ...patch });
  const valider = () => {
    const propre = nom.trim().slice(0, 80);
    if (propre && propre !== espace.nom) modifier({ nom: propre });
    else setNom(espace.nom);
  };
  const pastille = 'grid size-8 place-items-center rounded-full transition-transform duration-150 hover:scale-110';
  const anneau = 'ring-2 ring-shell-foreground/40 ring-offset-2 ring-offset-shell-raised';
  return (
    <>
      <div className="flex items-center gap-4 rounded-xl border border-shell-border bg-shell-base/40 p-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full text-[22px] font-semibold text-white shadow-sm" style={{ background: espace.teinte || 'var(--accent-escale)' }}>
          {espace.icone || espace.nom.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onBlur={valider}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label={t('Nom')}
            className="h-8 w-full rounded-md bg-transparent px-1 text-[17px] font-semibold outline-none hover:bg-shell-hover focus:bg-shell-input"
          />
          <div className="px-1 text-[12px] text-shell-muted">{espace.prive ? t('Navigation privée : rien n’est gardé à la fermeture.') : t('Chaque espace garde ses onglets, ses connexions et ses extensions.')}</div>
        </div>
      </div>
      <Carte titre={t('Icône')}>
        <div className="flex flex-wrap items-center gap-1.5 p-3">
          <button title={t('Initiale')} onClick={() => modifier({ icone: null })} className={cn(pastille, 'text-[12px] font-semibold', !espace.icone && 'bg-shell-active')}>
            {espace.nom.charAt(0).toUpperCase()}
          </button>
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => modifier({ icone: e })} className={cn(pastille, 'text-[16px]', espace.icone === e && 'bg-shell-active')}>
              {e}
            </button>
          ))}
          <input
            maxLength={4}
            placeholder="🙂"
            aria-label={t('Autre emoji')}
            title={t('Un autre emoji, puis Entrée')}
            onKeyDown={(e) => {
              const v = (e.target as HTMLInputElement).value.trim();
              if (e.key === 'Enter' && v) {
                modifier({ icone: v });
                (e.target as HTMLInputElement).value = '';
              }
            }}
            className="h-8 w-14 rounded-md bg-shell-input px-1.5 text-center text-[14px] outline-none focus:ring-1 focus:ring-shell-border"
          />
        </div>
      </Carte>
      <Carte titre={t('Couleur')}>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <button title={t('Aucune')} onClick={() => modifier({ teinte: null })} className={cn('size-7 rounded-full', !espace.teinte && anneau)} style={{ background: 'var(--accent-escale)' }} />
          {TEINTES.map((c) => (
            <button key={c} onClick={() => modifier({ teinte: c })} className={cn('size-7 rounded-full transition-transform duration-150 hover:scale-110', espace.teinte === c && anneau)} style={{ background: c }} />
          ))}
        </div>
      </Carte>
    </>
  );
}

// ---------------------------------------------------------------- Confidentialité

const PERIODES: [string, string][] = [['heure', 'Dernière heure'], ['jour', '24 heures'], ['semaine', '7 jours'], ['tout', 'Tout']];

function EffacerDonnees() {
  const [periode, setPeriode] = React.useState('heure');
  const [quoi, setQuoi] = React.useState({ historique: true, cookies: false, cache: true });
  const [etat, setEtat] = React.useState<'repos' | 'en-cours' | 'fait'>('repos');
  const transition = useMouvement();
  const effacer = async () => {
    setEtat('en-cours');
    await agir('donnees.effacer', { periode, ...quoi });
    setEtat('fait');
    setTimeout(() => setEtat('repos'), 2500);
  };
  const cases: [keyof typeof quoi, string, string][] = [
    ['historique', 'Historique', 'Pour la période choisie.'],
    ['cookies', 'Cookies et données des sites', 'Vous serez déconnecté des sites, dans tous les espaces.'],
    ['cache', 'Images et fichiers en cache', 'Les pages se rechargeront un peu plus lentement.']
  ];
  return (
    <Ligne titre={t('Effacer les données de navigation')} dessous>
      <div className="flex flex-wrap gap-1 rounded-lg bg-shell-input p-0.5">
        {PERIODES.map(([v, l]) => (
          <button key={v} onClick={() => setPeriode(v)} className={cn('relative rounded-md px-2.5 py-1 text-[12.5px]', v === periode ? 'text-shell-foreground' : 'text-shell-muted hover:text-shell-foreground')}>
            {v === periode && <motion.span layoutId="segment-periode" transition={transition} className="absolute inset-0 rounded-md bg-shell-raised shadow-[0_0_0_1px_var(--shell-border)]" />}
            <span className="relative">{t(l)}</span>
          </button>
        ))}
      </div>
      <div className="space-y-1.5 pt-1">
        {cases.map(([cle, titre, detail]) => (
          <label key={cle} className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" checked={quoi[cle]} onChange={(e) => setQuoi({ ...quoi, [cle]: e.target.checked })} className="mt-0.5 size-3.5 accent-[var(--accent-escale)]" />
            <span>
              <span className="text-[12.5px]">{t(titre)}</span>
              <span className="block text-[11.5px] text-shell-muted">{t(detail)}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={effacer}
          disabled={etat === 'en-cours' || !(quoi.historique || quoi.cookies || quoi.cache)}
          className="h-7 rounded-lg bg-red-500/12 px-3 text-[12.5px] font-medium text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-50 dark:text-red-400"
        >
          {etat === 'en-cours' ? t('Effacement…') : t('Effacer')}
        </button>
        {etat === 'fait' && (
          <span className="flex items-center gap-1 text-[12px] text-shell-muted">
            <Check className="size-3.5 text-accent-escale" />
            {t('C’est effacé.')}
          </span>
        )}
      </div>
    </Ligne>
  );
}

// ---------------------------------------------------------------- Navigateur

function NavigateurParDefaut() {
  const [etat, setEtat] = React.useState<{ defaut: boolean; dev: boolean } | null>(null);
  const [demande, setDemande] = React.useState(false);
  const relire = React.useCallback(() => agir('defaut.etat').then((r) => setEtat(r as { defaut: boolean; dev: boolean })), []);
  React.useEffect(() => {
    relire();
    // Le choix se fait dans les réglages de Windows : on relit au retour.
    window.addEventListener('focus', relire);
    return () => window.removeEventListener('focus', relire);
  }, [relire]);
  if (!etat) return <Ligne titre={t('Navigateur par défaut')} />;
  return (
    <Ligne
      titre={t('Navigateur par défaut')}
      detail={
        etat.defaut
          ? t('Les liens ouverts ailleurs (mails, messageries…) arrivent dans Escale.')
          : etat.dev
            ? t('Indisponible dans la version de développement.')
            : demande
              ? t('Choisissez Escale dans la fenêtre de Windows qui vient de s’ouvrir.')
              : t('Pour que les liens ouverts ailleurs arrivent dans Escale.')
      }
    >
      {etat.defaut ? (
        <span className="flex items-center gap-1 text-[12.5px] font-medium text-accent-escale">
          <Check className="size-4" />
          {t('Activé')}
        </span>
      ) : (
        <button
          disabled={etat.dev}
          onClick={async () => {
            setDemande(true);
            await agir('defaut.definir');
          }}
          className={bouton}
        >
          {t('Définir par défaut')}
        </button>
      )}
    </Ligne>
  );
}

type Import = { importes?: number; espace?: string; erreur?: string };

/** Reprendre les sessions de Firefox (cookies) dans l'espace actif. */
function ImportFirefox() {
  const [etat, setEtat] = React.useState<'repos' | 'en-cours' | Import>('repos');
  const lancer = async () => {
    setEtat('en-cours');
    try {
      setEtat((await agir('import.firefox')) as Import);
    } catch {
      setEtat({ erreur: 'echec' });
    }
  };
  const resultat =
    typeof etat === 'object'
      ? etat.erreur === 'introuvable'
        ? t('Aucun profil Firefox trouvé sur cet ordinateur.')
        : etat.erreur
          ? t("L'import n'a pas abouti.")
          : t('{n} cookies importés dans « {espace} ».', { n: etat.importes ?? 0, espace: etat.espace ?? '' })
      : null;
  return (
    <Ligne titre={t('Importer depuis Firefox')} detail={resultat ?? t('Reprend vos sessions Firefox dans l’espace actif : vous restez connecté aux mêmes sites.')}>
      <button onClick={lancer} disabled={etat === 'en-cours'} className={bouton}>
        {etat === 'en-cours' ? t('Import…') : t('Importer')}
      </button>
    </Ligne>
  );
}

// ---------------------------------------------------------------- Raccourcis

const CTRL = window.escale.plateforme === 'darwin' ? '⌘' : 'Ctrl';
const RACCOURCIS: [string, [string, string][]][] = [
  ['Onglets', [['Nouvel onglet', `${CTRL} T`], ['Fermer l’onglet', `${CTRL} W`], ['Rouvrir l’onglet fermé', `${CTRL} Maj T`], ['Onglet suivant', 'Ctrl Tab'], ['Onglet précédent', 'Ctrl Maj Tab'], ['Changer d’espace', `${CTRL} 1 … 9`]]],
  ['Page', [['Ouvrir une adresse', `${CTRL} L`], ['Rechercher dans la page', `${CTRL} F`], ['Mode lecture', `${CTRL} Alt R`], ['Traduire la page', `${CTRL} Alt T`], ['Image dans l’image', `${CTRL} Alt P`], ['Imprimer', `${CTRL} P`], ['Enregistrer la page', `${CTRL} Alt S`]]],
  ['Escale', [['Masquer la barre latérale', `${CTRL} S`], ['Réduire la barre latérale', `${CTRL} Maj S`], ['Historique', `${CTRL} H`], ['Navigation privée', `${CTRL} Maj N`], ['Réglages', `${CTRL} ,`]]]
];

function SectionRaccourcis() {
  return (
    <>
      {RACCOURCIS.map(([groupe, liste]) => (
        <Carte key={groupe} titre={t(groupe)}>
          {liste.map(([action, touches]) => (
            <div key={action} className="flex items-center justify-between px-4 py-2">
              <span className="text-[13px]">{t(action)}</span>
              <span className="flex gap-1">
                {touches.split(' ').map((k, i) => (
                  <kbd key={i} className="min-w-6 rounded-md border border-shell-border bg-shell-input px-1.5 py-0.5 text-center text-[11.5px] font-medium text-shell-muted">
                    {k === 'Maj' ? t('Maj') : k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </Carte>
      ))}
    </>
  );
}

function SectionAPropos() {
  const [version, setVersion] = React.useState('');
  React.useEffect(() => {
    agir('app.infos').then((r) => setVersion((r as { version: string }).version));
  }, []);
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <Logo className="size-16" />
      <div>
        <div className="text-[18px] font-semibold tracking-tight">Escale</div>
        <div className="text-[12.5px] text-shell-muted">{t('Version {v}', { v: version })}</div>
      </div>
      <p className="max-w-[340px] text-[12.5px] text-shell-muted">{t('Un navigateur à onglets verticaux, avec dossiers, espaces et extensions Chrome.')}</p>
      <button onClick={() => agir('maj.ouvrir', { url: 'https://github.com/Luth-infinity/escale/releases' })} className={bouton}>
        {t('Notes de version')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Page

type Section = { id: string; titre: string; icone: React.ComponentType<{ className?: string }>; contenu: () => React.ReactNode };

const SECTIONS: Section[] = [
  { id: 'profil', titre: 'Profil', icone: UserRound, contenu: () => <SectionProfil /> },
  {
    id: 'general',
    titre: 'Général',
    icone: SlidersHorizontal,
    contenu: () => (
      <>
        <Carte titre={t('Apparence')}>
          <Selection cle="theme" titre="Thème" options={[['system', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']]} />
          <Selection cle="langue" titre="Langue" options={[['system', 'Système'], ['fr', 'Français'], ['en', 'English']]} />
        </Carte>
        <Carte titre={t('Recherche')}>
          <Selection cle="moteur" titre="Moteur de recherche" options={[['google', 'Google'], ['duckduckgo', 'DuckDuckGo'], ['bing', 'Bing'], ['qwant', 'Qwant'], ['ecosia', 'Ecosia']]} />
          <Bascule cle="suggestions" titre="Suggestions de recherche" detail="Envoie ce que vous tapez au moteur (jamais une adresse)." />
        </Carte>
      </>
    )
  },
  {
    id: 'onglets',
    titre: 'Onglets',
    icone: PanelsTopLeft,
    contenu: () => (
      <>
        <Carte titre={t('Rangement automatique')}>
          <Selection cle="fermetureAutoHeures" titre="Fermer les onglets du jour inactifs après" detail="Les onglets épinglés et ceux des dossiers ne sont jamais fermés." options={[[6, '6 h'], [12, '12 h'], [24, '24 h'], [168, '7 jours'], [0, 'Jamais']]} />
          <Selection cle="veilleMinutes" titre="Mettre en veille les onglets inactifs après" detail="Un onglet en veille libère sa mémoire et se recharge quand on y revient." options={[[10, '10 min'], [20, '20 min'], [60, '1 h'], [0, 'Jamais']]} />
        </Carte>
        <Carte titre={t('Barre latérale')}>
          <Bascule cle="barreMasquee" titre="Masquer la barre latérale" detail="Elle revient quand le pointeur touche le bord gauche. Raccourci : Ctrl S." />
          <Bascule cle="barreRepliee" titre="Barre réduite" detail="Seulement les icônes des onglets. Raccourci : Ctrl Maj S." />
        </Carte>
      </>
    )
  },
  {
    id: 'confidentialite',
    titre: 'Confidentialité',
    icone: Shield,
    contenu: () => (
      <>
        <Carte titre={t('Protection')}>
          <Bascule cle="bloqueur" titre="Bloquer les publicités et les traqueurs" detail="Liste intégrée des principales régies." />
        </Carte>
        <Carte titre={t('Historique et données')}>
          <Ligne titre={t('Historique')} detail={t('Les pages visitées, par jour, avec recherche. Raccourci : Ctrl H.')}>
            <button onClick={() => commandeLocale('historique')} className={cn(bouton, 'flex items-center gap-1.5')}>
              <History className="size-3.5" />
              {t('Ouvrir')}
            </button>
          </Ligne>
          <EffacerDonnees />
        </Carte>
        <Carte titre={t('Navigation privée')}>
          <Ligne titre={t('Ouvrir un espace privé')} detail={t('Ni historique, ni cookies gardés, ni extensions ; il disparaît à la fermeture d’Escale. Raccourci : Ctrl Maj N.')}>
            <button onClick={() => agir('espace.prive', { nom: t('Navigation privée') })} className={bouton}>
              {t('Ouvrir')}
            </button>
          </Ligne>
        </Carte>
      </>
    )
  },
  {
    id: 'youtube',
    titre: 'YouTube',
    icone: Play,
    contenu: () => (
      <Carte titre={t('Sur YouTube')}>
        <Bascule cle="ambiance" titre="Ambiance" detail="Prolonge la vidéo derrière la page pendant la lecture." />
        <Bascule cle="sponsors" titre="Passer sponsors et pubs" detail="Passages signalés par SponsorBlock, et bouton « Ignorer » des publicités." />
        <Ligne titre={t('Télécharger une vidéo')} detail={t('Depuis la bulle d’Escale, sur la page de la vidéo : MP4, MP3, M4A, WAV ou miniature. Les fichiers vont dans Téléchargements.')} />
      </Carte>
    )
  },
  {
    id: 'navigateur',
    titre: 'Navigateur',
    icone: Globe,
    contenu: () => (
      <Carte>
        <NavigateurParDefaut />
        <ImportFirefox />
      </Carte>
    )
  },
  { id: 'raccourcis', titre: 'Raccourcis', icone: Keyboard, contenu: () => <SectionRaccourcis /> },
  { id: 'apropos', titre: 'À propos', icone: Info, contenu: () => <SectionAPropos /> }
];

const CLE_SECTION = 'escale-reglages-section';
const lireSection = () => {
  try {
    return localStorage.getItem(CLE_SECTION) || 'profil';
  } catch {
    return 'profil';
  }
};

export function Reglages({ fermer }: { fermer: () => void }) {
  const transition = useMouvement();
  const fond = useModalePage();
  const [section, setSection] = React.useState(() => (SECTIONS.some((s) => s.id === lireSection()) ? lireSection() : 'profil'));
  const choisir = (id: string) => {
    setSection(id);
    try {
      localStorage.setItem(CLE_SECTION, id);
    } catch {
      // Stockage indisponible : on rouvrira sur le profil.
    }
  };
  React.useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && fermer();
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [fermer]);
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  return (
    <div className="absolute inset-0 z-20" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      {fond && <img src={fond} alt="" className="pointer-events-none absolute inset-0 size-full rounded-[10px] object-cover" />}
      <motion.div className="pointer-events-none absolute inset-0 rounded-[10px] bg-black/10 dark:bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} />
      <motion.div
        role="dialog"
        aria-label={t('Réglages')}
        initial={{ opacity: 0, scale: 0.98, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={transition}
        className="absolute top-1/2 left-1/2 flex h-[min(600px,88%)] w-[min(820px,calc(100%-40px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-shell-border bg-shell-raised shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)]"
      >
        <nav className="flex w-[196px] shrink-0 flex-col gap-0.5 border-r border-shell-border bg-shell-base/50 p-2.5">
          <div className="px-2.5 pt-1.5 pb-3 text-[15px] font-semibold tracking-tight">{t('Réglages')}</div>
          {SECTIONS.map((s) => {
            const Icone = s.icone;
            const ici = s.id === active.id;
            return (
              <button
                key={s.id}
                onClick={() => choisir(s.id)}
                className={cn('relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors', ici ? 'text-shell-foreground' : 'text-shell-muted hover:bg-shell-hover hover:text-shell-foreground')}
              >
                {ici && <motion.span layoutId="reglages-section" transition={transition} className="absolute inset-0 rounded-lg bg-shell-active" />}
                <Icone className="relative size-4 shrink-0" />
                <span className="relative">{t(s.titre)}</span>
              </button>
            );
          })}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-shell-border pr-3 pl-5">
            <h2 className="text-[15px] font-semibold tracking-tight">{t(active.titre)}</h2>
            <button onClick={fermer} title={t('Fermer')} className="grid size-7 place-items-center rounded-md text-shell-muted hover:bg-shell-hover">
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="space-y-5 p-5"
              >
                {active.contenu()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
