import * as React from 'react';
import { cn } from '@/lib/utils';

// Même filtre que isUsableFavicon côté principal : `data:,` est une URL valide
// mais vide, qui ne déclenche ni load ni error et laisse un glyphe cassé.
const utilisable = (src: string | null) => !!src && (/^https?:/.test(src) || (src.startsWith('data:') && src.length > 64));

function initiale(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').charAt(0).toUpperCase() || '·';
  } catch {
    return '·';
  }
}

/** Le favicon d'un onglet, ou l'initiale de son domaine : jamais d'image cassée. */
export const Favicon = React.memo(function Favicon({ src, url, className }: { src: string | null; url: string; className?: string }) {
  const [echec, setEchec] = React.useState(false);
  React.useEffect(() => setEchec(false), [src]);
  if (!utilisable(src) || echec) {
    return (
      <span className={cn('grid size-4 shrink-0 place-items-center rounded-[4px] bg-shell-active text-[9px] font-semibold text-shell-muted', className)} aria-hidden>
        {initiale(url)}
      </span>
    );
  }
  return <img src={src!} alt="" draggable={false} onError={() => setEchec(true)} className={cn('size-4 shrink-0 rounded-[3px]', className)} />;
});
