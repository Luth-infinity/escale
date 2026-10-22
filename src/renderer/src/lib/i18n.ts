import en from '../../../main/en.json';

// Même dictionnaire et même règle que src/main/i18n.js : la clé est le texte
// français, un oubli retombe sur le français.
const dico = en as Record<string, string>;
let lang: 'fr' | 'en' = 'fr';

export function setLanguage(pref: string | undefined) {
  const locale = !pref || pref === 'system' ? navigator.language : pref;
  lang = locale.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  document.documentElement.lang = lang;
  return lang;
}

export const getLanguage = () => lang;

export function t(fr: string, vars?: Record<string, string | number>) {
  const texte = lang === 'en' && dico[fr] ? dico[fr] : fr.split('|')[0];
  return vars ? texte.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : texte;
}
