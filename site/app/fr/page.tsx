import type { Metadata } from 'next';
import Vitrine from '../vitrine';
import { fr } from '../content';

export const metadata: Metadata = {
  title: fr.meta.title,
  description: fr.meta.description,
  alternates: { canonical: '/fr', languages: { en: '/', fr: '/fr' } }
};

export default function FrenchPage() {
  return <Vitrine t={fr} locale="fr" />;
}
