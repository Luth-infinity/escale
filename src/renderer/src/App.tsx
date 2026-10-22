import { useSyncedTheme } from './lib/theme';

/**
 * Le shell : la barre latérale à gauche, la page encadrée à droite. La page
 * elle-même est une vue native posée par le process principal dans la zone
 * `#zone-page` (inset de 8 px, coins de 10 px).
 */
export default function App() {
  useSyncedTheme();
  const mac = window.escale.plateforme === 'darwin';
  return (
    <div className="flex h-full">
      <aside className="flex w-[240px] shrink-0 flex-col">
        <div className={`drag h-[52px] shrink-0 ${mac ? 'pl-[86px]' : ''}`} />
      </aside>
      <main className="relative flex-1 p-2 pl-0">
        <div id="zone-page" className="h-full w-full rounded-[10px] border border-shell-border bg-shell-raised" />
      </main>
    </div>
  );
}
