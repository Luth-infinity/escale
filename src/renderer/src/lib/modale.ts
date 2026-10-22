import * as React from 'react';
import { agir } from '@/etat';

/**
 * Une modale du shell : la page native passerait par-dessus. On la remplace par
 * son image le temps de l'ouverture, puis on masque la vraie vue.
 * Renvoie l'image à poser en fond.
 */
export function useModalePage() {
  const [fond, setFond] = React.useState<string | null>(null);
  React.useEffect(() => {
    let vivant = true;
    agir('page.capture').then((img) => {
      if (!vivant) return;
      setFond((img as string) || null);
      agir('layout.overlay', { actif: true });
    });
    return () => {
      vivant = false;
      agir('layout.overlay', { actif: false });
    };
  }, []);
  return fond;
}
