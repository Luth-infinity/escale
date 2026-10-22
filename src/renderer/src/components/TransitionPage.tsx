import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTransitionPage } from '@/etat';

const DUREE = 0.16; // s ; le principal révèle la vraie page à 170 ms

/**
 * Le fondu croisé entre deux pages. Le principal masque la vue native le temps
 * du fondu : ces deux images, posées dans la zone de page, sont alors visibles.
 */
export function TransitionPage() {
  const reduit = useReducedMotion();
  const [images, setImages] = React.useState<{ n: number; de: string; vers: string | null } | null>(null);
  const compteur = React.useRef(0);
  const minuteur = React.useRef(0);
  useTransitionPage((de, vers) => {
    const n = ++compteur.current;
    setImages({ n, de, vers });
    window.clearTimeout(minuteur.current);
    minuteur.current = window.setTimeout(() => setImages((i) => (i?.n === n ? null : i)), 200);
  });
  const duree = reduit ? 0.1 : DUREE;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[10px]">
      <AnimatePresence>
        {images && (
          <motion.div key={images.n} className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.06 } }}>
            {images.vers && <img src={images.vers} alt="" className="absolute inset-0 size-full object-cover" />}
            <motion.img
              src={images.de}
              alt=""
              className="absolute inset-0 size-full object-cover"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: duree, ease: 'easeOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
