import { useReducedMotion } from 'motion/react';

/**
 * Le mouvement d'Escale : un ressort quasi critique (≈ 200 ms, sans rebond
 * visible), interruptible — recliquer repart de la position courante.
 * Avec « réduire les animations », tout devient un fondu de 100 ms.
 */
export const RESSORT = { type: 'spring', stiffness: 520, damping: 44, mass: 1 } as const;
export const FONDU_REDUIT = { duration: 0.1 } as const;
export const FONDU_RAPIDE = { duration: 0.1, ease: 'easeOut' } as const;

export function useMouvement() {
  return useReducedMotion() ? FONDU_REDUIT : RESSORT;
}
