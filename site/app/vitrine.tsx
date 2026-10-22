import type { Contenu, Langue } from './content';
import { BasculeLangue } from './bascule-langue';
import { Demo } from './demo';

/**
 * La page, écrite une fois, alimentée par le dictionnaire de la langue.
 * Le fichier ne s'appelle pas `Page.tsx` : sous Windows, ce serait la route.
 */

const SUITE = 'https://luth-apps.vercel.app';
export const REPO = 'https://github.com/Luth-infinity/escale';
/**
 * La dernière version publiée, lue sur GitHub (relue toutes les dix minutes) :
 * le site suit les releases sans qu'on y touche. Les noms viennent de
 * electron-builder.yml (`artifactName`) ; un .dmg pas encore construit (le
 * workflow macOS tourne quelques minutes après la publication) mène à la page
 * de la release.
 */
async function derniereVersion() {
  const page = `${REPO}/releases/latest`;
  try {
    const r = await fetch('https://api.github.com/repos/Luth-infinity/escale/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 600 }
    });
    if (!r.ok) throw new Error(String(r.status));
    const release = (await r.json()) as { tag_name: string; assets: { name: string; browser_download_url: string }[] };
    const fichier = (motif: RegExp) => release.assets.find((a) => motif.test(a.name))?.browser_download_url ?? page;
    return {
      version: release.tag_name.replace(/^v/, ''),
      mac: fichier(/-arm64\.dmg$/),
      win: fichier(/Setup-.*-x64\.exe$/)
    };
  } catch {
    return { version: '', mac: page, win: page };
  }
}

const LANGUES = [
  { code: 'fr', libelle: 'FR', href: '/fr' },
  { code: 'en', libelle: 'EN', href: '/' }
];
const SECTIONS = ['fonctions', 'commande', 'chiffres', 'extensions', 'securite', 'telecharger'];

const LIEN_NAV = 'hidden rounded-full px-3 py-1.5 text-sm text-ink-soft transition-colors hover:text-ink sm:block';
const BOUTON = 'inline-flex items-center justify-center rounded-full px-6 py-3 text-[15px] font-medium transition-colors';

function Logo({ className = 'size-7' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icon.svg" alt="" width={64} height={64} className={className} />;
}

function Titre({ children }: { children: React.ReactNode }) {
  return <h2 className="headline max-w-[18ch] text-[36px] sm:text-[48px]">{children}</h2>;
}

export default async function Vitrine({ t, locale }: { t: Contenu; locale: Langue }) {
  const DOWNLOADS = await derniereVersion();
  // Sans réponse de GitHub, le badge garde ses plateformes et perd son numéro.
  const badge = DOWNLOADS.version ? t.hero.badge.replace('{v}', DOWNLOADS.version) : t.hero.badge.replace(/^[^·]*· /, '');
  return (
    <div lang={locale}>
      <header className="sticky top-0 z-50 border-b border-line bg-page">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3 sm:px-6">
          <a href="#top" className="mr-auto flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <Logo className="size-6" />
            Escale
          </a>
          <a href="#fonctions" className={LIEN_NAV}>
            {t.nav.fonctions}
          </a>
          <a href="#securite" className={LIEN_NAV}>
            {t.nav.securite}
          </a>
          <BasculeLangue
            langues={LANGUES}
            locale={locale}
            label={t.nav.langue}
            sections={SECTIONS}
            fond="mx-1 ring-1 ring-line"
            pastille="bg-card ring-1 ring-line"
          />
          <a href="#telecharger" className="ml-1 rounded-full bg-escale px-4 py-2 text-sm font-medium text-white">
            {t.nav.telecharger}
          </a>
        </nav>
      </header>

      <main id="top" className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="pt-16 pb-12 text-center sm:pt-24">
          <p className="text-[13px] text-ink-soft">{badge}</p>
          <h1 className="headline mx-auto mt-5 max-w-[14ch] text-[48px] sm:text-[80px]">{t.hero.titre}</h1>
          <p className="mx-auto mt-6 max-w-[54ch] text-[17px] leading-relaxed text-ink-soft">{t.hero.texte}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#telecharger" className={`${BOUTON} bg-escale text-white`}>
              {t.hero.telecharger}
            </a>
            <a href={REPO} className={`${BOUTON} bg-card ring-1 ring-line hover:bg-page`}>
              {t.hero.code}
            </a>
          </div>
        </section>

        <Demo t={t.demo} />

        <section id="fonctions" className="scroll-mt-20 pt-28">
          <Titre>{t.fonctions.titre}</Titre>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {t.fonctions.items.map((f) => (
              <div key={f.titre} className="border-t border-line pt-5">
                <h3 className="text-[17px] font-semibold tracking-tight">{f.titre}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{f.texte}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="commande" className="grid scroll-mt-20 items-center gap-10 pt-28 lg:grid-cols-2">
          <div>
            <Titre>{t.commande.titre}</Titre>
            <p className="mt-5 max-w-[48ch] text-[17px] leading-relaxed text-ink-soft">{t.commande.texte}</p>
            <dl className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {t.commande.prefixes.map((p) => (
                <div key={p.cle} className="flex items-center gap-2">
                  <dt>
                    <kbd className="rounded-md bg-card px-1.5 py-0.5 font-mono text-[12px] ring-1 ring-line">{p.cle}</kbd>
                  </dt>
                  <dd className="text-ink-soft">{p.texte}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div aria-hidden className="rounded-[14px] bg-card p-2 shadow-[0_30px_70px_-30px_rgb(20_24_30/.3)] ring-1 ring-line">
            <p className="flex items-center gap-2 border-b border-line px-3 pt-2 pb-3.5 text-[16px]">
              {t.commande.saisie}
              <span className="h-5 w-px bg-escale" />
              <kbd className="ml-auto rounded-md bg-page px-1.5 py-0.5 text-[11px] text-ink-soft">⌘T</kbd>
            </p>
            <ul className="pt-1.5 text-sm">
              {t.commande.lignes.map((l, i) => (
                <li
                  key={l.texte}
                  className={`flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 ${i === 0 ? 'bg-escale/10' : ''}`}
                >
                  <span className="truncate">{l.texte}</span>
                  <span className="shrink-0 text-[12px] text-ink-soft">{l.type}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="chiffres" className="scroll-mt-20 pt-28">
          <div className="rounded-[20px] bg-ink px-6 py-12 text-white sm:px-12 sm:py-14">
            <h2 className="headline text-[32px] sm:text-[44px]">{t.chiffres.titre}</h2>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-white/60">{t.chiffres.sous}</p>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {t.chiffres.items.map((c) => (
                <div key={c.valeur}>
                  <p className="headline text-[34px]">{c.valeur}</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{c.texte}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="extensions" className="grid scroll-mt-20 gap-10 pt-28 lg:grid-cols-2">
          <div>
            <Titre>{t.extensions.titre}</Titre>
            <p className="mt-5 max-w-[48ch] text-[17px] leading-relaxed text-ink-soft">{t.extensions.texte}</p>
          </div>
          <div>
            <dl className="divide-y divide-line border-y border-line">
              {t.extensions.lignes.map((l) => (
                <div key={l.nom} className="grid gap-1 py-4 sm:grid-cols-[1fr_1.2fr] sm:gap-6">
                  <dt className="text-[15px] font-medium">{l.nom}</dt>
                  <dd className="text-[15px] text-ink-soft">{l.etat}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-ink-soft">{t.extensions.note}</p>
          </div>
        </section>

        <section id="securite" className="scroll-mt-20 pt-28">
          <Titre>{t.securite.titre}</Titre>
          <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-ink-soft">{t.securite.texte}</p>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {t.securite.items.map((f) => (
              <div key={f.titre} className="border-t border-line pt-5">
                <h3 className="text-[17px] font-semibold tracking-tight">{f.titre}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{f.texte}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-[70ch] text-[15px] leading-relaxed font-medium">{t.securite.reseau}</p>
        </section>

        <section id="telecharger" className="scroll-mt-20 pt-28 pb-24">
          <div className="rounded-[20px] bg-card px-6 py-12 text-center ring-1 ring-line sm:py-16">
            <Logo className="mx-auto size-14" />
            <h2 className="headline mt-6 text-[36px] sm:text-[48px]">{t.telecharger.titre}</h2>
            <p className="mt-3 text-[17px] text-ink-soft">{t.telecharger.texte}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a data-cta="mac" href={DOWNLOADS.mac} className={`${BOUTON} bg-escale text-white`}>
                {t.telecharger.mac}
              </a>
              <a data-cta="win" href={DOWNLOADS.win} className={`${BOUTON} bg-escale text-white`}>
                {t.telecharger.win}
              </a>
            </div>
            <p className="mt-4 text-sm text-ink-soft">
              <a data-cta-autre="mac" href={DOWNLOADS.win} className="underline underline-offset-4 hover:text-ink">
                {t.telecharger.win}
              </a>
              <a data-cta-autre="win" href={DOWNLOADS.mac} className="underline underline-offset-4 hover:text-ink">
                {t.telecharger.mac}
              </a>
              <span data-cta-autre="mac"> · </span>
              <span data-cta-autre="win"> · </span>
              <a href={`${REPO}/releases`} className="underline underline-offset-4 hover:text-ink">
                {t.telecharger.toutes}
              </a>
            </p>
            <p className="mx-auto mt-8 max-w-[60ch] rounded-lg bg-page px-4 py-3 text-sm leading-relaxed text-ink-soft">
              {t.telecharger.prive}
            </p>
            <div className="mx-auto mt-3 max-w-[60ch] space-y-2 text-[13px] leading-relaxed break-words text-ink-soft">
              <span data-cta="mac" className="block">
                {t.telecharger.noteMac}
              </span>
              <span data-cta="win" className="block">
                {t.telecharger.noteWin}
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-8 text-sm text-ink-soft sm:px-6">
          <span className="flex items-center gap-2 font-medium text-ink">
            <Logo className="size-5" />
            Escale
          </span>
          <a href={SUITE} className="underline-offset-4 hover:text-ink hover:underline">
            {t.pied.suite}
          </a>
          <a href={REPO} className="underline-offset-4 hover:text-ink hover:underline">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
