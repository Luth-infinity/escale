import test from 'node:test';
import assert from 'node:assert';
import { decouperAdresse } from './adresse.ts';

test('le domaine enregistrable est séparé de ses sous-domaines', () => {
  assert.deepStrictEqual(decouperAdresse('https://docs.github.com/fr/x?y'), { avant: 'docs.', domaine: 'github.com', securise: true });
  assert.deepStrictEqual(decouperAdresse('https://www.bbc.co.uk/'), { avant: 'www.', domaine: 'bbc.co.uk', securise: true });
  assert.deepStrictEqual(decouperAdresse('https://impots.gouv.fr/'), { avant: '', domaine: 'impots.gouv.fr', securise: true });
  assert.deepStrictEqual(decouperAdresse('http://exemple.fr/'), { avant: '', domaine: 'exemple.fr', securise: false });
});

test('un domaine internationalisé reste en punycode (anti-homographe)', () => {
  // « аpple.com » avec un а cyrillique : Chromium le parse en xn--pple-43d.com.
  assert.strictEqual(decouperAdresse('https://аpple.com/').domaine, 'xn--pple-43d.com');
});

test('adresses sans hôte : affichées telles quelles', () => {
  assert.deepStrictEqual(decouperAdresse('about:blank'), { avant: '', domaine: 'about:blank', securise: false });
  assert.deepStrictEqual(decouperAdresse('http://localhost:5373/'), { avant: '', domaine: 'localhost:5373', securise: false });
  assert.deepStrictEqual(decouperAdresse('https://192.168.1.1/'), { avant: '', domaine: '192.168.1.1', securise: true });
  assert.strictEqual(decouperAdresse('pas une url').domaine, 'pas une url');
});
