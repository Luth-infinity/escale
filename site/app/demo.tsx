'use client';

import * as React from 'react';
import type { Contenu, Onglet } from './content';

/**
 * La fenêtre d'Escale, en HTML. On peut changer d'espace et d'onglet : la
 * teinte glisse d'un espace à l'autre et la page passe en fondu, comme dans
 * l'app. Rien ne bouge tant qu'on ne touche à rien.
 */
export function Demo({ t }: { t: Contenu['demo'] }) {
  const [rang, setRang] = React.useState(0);
  const espace = t.espaces[rang];
  const tous = [...espace.dossier.onglets, ...espace.onglets];
  const [actif, setActif] = React.useState<Onglet>(espace.onglets[0]);
  const ouvert = tous.includes(actif) ? actif : espace.onglets[0];

  const ligne = (o: Onglet, retrait = false) => (
    <button
      key={o.titre}
      onClick={() => setActif(o)}
      aria-pressed={o === ouvert}
      className={`demo-onglet flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left ${retrait ? 'pl-6' : 'pl-2'}`}
    >
      <span className="grid size-3.5 shrink-0 place-items-center rounded-[4px] bg-ink/10 text-[8px] font-semibold text-ink-soft">
        {o.domaine[0].toUpperCase()}
      </span>
      <span className="truncate">{o.titre}</span>
    </button>
  );

  return (
    <figure aria-label={t.label}>
      <div
        className="demo-fenetre flex h-[400px] overflow-hidden rounded-[14px] text-[12px] sm:h-[460px] sm:text-[12.5px]"
        style={{ '--teinte': espace.couleur } as React.CSSProperties}
      >
        <aside className="flex w-[44%] max-w-[240px] shrink-0 flex-col gap-2 p-2 sm:w-[240px]">
          <div className="flex gap-1.5 px-1.5 pt-1.5 pb-1" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="truncate rounded-lg bg-ink/[.06] px-2.5 py-1.5">
            <span className="text-ink-soft">{ouvert.domaine}</span>
          </div>
          <p className="px-2 pt-1 font-semibold">{espace.nom}</p>
          <div className="grid grid-cols-4 gap-1.5" aria-hidden>
            {espace.epingles.map((e) => (
              <span key={e} className="demo-epingle grid h-8 place-items-center rounded-md text-[11px] font-semibold text-ink-soft">
                {e}
              </span>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <p className="flex items-center gap-2 px-2 py-1.5 font-medium">
              <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden>
                <path d="M2 4.5h4l1.5 1.5H14v6.5H2z" fill="none" stroke="var(--teinte)" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              <span className="truncate">{espace.dossier.nom}</span>
            </p>
            {espace.dossier.onglets.map((o) => ligne(o, true))}
            <p className="mt-3 px-2 pb-1 text-[11px] text-ink-soft">{t.aujourdhui}</p>
            {espace.onglets.map((o) => ligne(o))}
          </div>
          <div className="flex items-center justify-center gap-2 pb-1">
            {t.espaces.map((e, i) => (
              <button
                key={e.nom}
                onClick={() => setRang(i)}
                aria-pressed={i === rang}
                aria-label={e.nom}
                title={e.nom}
                className="demo-espace grid size-6 place-items-center rounded-full"
              >
                <span className="size-2 rounded-full" style={{ background: e.couleur }} />
              </button>
            ))}
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-2 pl-0">
          <div className="demo-page h-full rounded-[11px] p-4 sm:p-7">
            <div key={ouvert.titre} className="demo-contenu">
              <p className="text-[11px] text-ink-soft">{ouvert.domaine}</p>
              <p className="mt-1 text-[17px] leading-tight font-semibold tracking-tight sm:text-[22px]">{ouvert.titre}</p>
              <div className="mt-5 grid gap-2.5" aria-hidden>
                {[92, 80, 86, 54].map((l) => (
                  <span key={l} className="h-2 rounded-full bg-ink/[.07]" style={{ width: `${l}%` }} />
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-2.5" aria-hidden>
                <span className="h-20 rounded-lg bg-ink/[.05] sm:h-28" />
                <span className="h-20 rounded-lg bg-ink/[.05] sm:h-28" />
              </div>
            </div>
          </div>
        </main>
      </div>
      <figcaption className="mt-4 text-center text-sm text-ink-soft">{t.astuce}</figcaption>
    </figure>
  );
}
