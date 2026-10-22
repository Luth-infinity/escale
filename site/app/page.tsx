import type { Metadata } from 'next';
import Vitrine from './vitrine';
import { en } from './content';

// L'anglais à la racine, comme sur les autres vitrines de Luth.
export const metadata: Metadata = {
  title: en.meta.title,
  description: en.meta.description,
  alternates: { canonical: '/', languages: { en: '/', fr: '/fr' } }
};

export default function EnglishPage() {
  return <Vitrine t={en} locale="en" />;
}
