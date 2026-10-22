/**
 * La liste blanche des actions du shell. Chacune a son schéma (vérifié par
 * ipc.js avant l'appel) et sa fonction, qui reçoit le contexte
 * { etat, onglets, fermes } puis la charge validée.
 *
 * Pur (aucun require d'electron) pour être testé sous Node.
 */
const ID = { type: 'string', max: 36 };
const ID_OU_NUL = { type: 'string', max: 36, nul: true };
const URL_ = { type: 'string', max: 8192 };
const NOM = { type: 'string', max: 80 };
const TEINTE = { type: 'string', max: 7, nul: true };
const OUI = { type: 'boolean' };
const RIEN = { type: 'objet', champs: {} };
const objet = (champs) => ({ type: 'objet', champs });
const opt = (s) => ({ ...s, optionnel: true });

const { resoudre, MOTEURS } = require('./commande');

const PILE_FERMES = 25;
const ZOOMS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

// Une teinte est injectée dans le CSS du shell : on n'accepte que #rrggbb.
const teinteValide = (t) => t === null || /^#[0-9a-f]{6}$/i.test(t);

function wcCourant(ctx) {
  const id = ctx.onglets.courantId();
  return id ? ctx.onglets.webContentsDe(id) : null;
}

function hote(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

const ACTIONS = {
  'onglet.ouvrir': {
    schema: objet({ url: URL_, espaceId: opt(ID), actif: opt(OUI) }),
    fn: (ctx, { url, espaceId, actif = true }) =>
      ctx.onglets.ouvrir(espaceId || ctx.etat.lire().espaceActif, url, { apres: null, actif })
  },
  'onglet.fermer': {
    schema: objet({ id: ID }),
    fn: (ctx, { id }) => {
      const o = ctx.etat.lire().onglets.find((x) => x.id === id);
      if (!o) return;
      ctx.fermes.push({ espaceId: o.espaceId, url: o.url });
      if (ctx.fermes.length > PILE_FERMES) ctx.fermes.shift();
      ctx.etat.appliquer('fermerOnglet', id);
    }
  },
  'onglet.restaurer': {
    schema: RIEN,
    fn: (ctx) => {
      const e = ctx.etat.lire();
      let f;
      // L'espace d'un onglet fermé a pu disparaître depuis : on passe au suivant.
      while ((f = ctx.fermes.pop())) {
        if (e.espaces.some((x) => x.id === f.espaceId)) return ctx.onglets.ouvrir(f.espaceId, f.url, { actif: true });
      }
    }
  },
  'onglet.activer': { schema: objet({ id: ID }), fn: (ctx, { id }) => ctx.etat.appliquer('activer', id) },
  'onglet.deplacer': {
    schema: objet({
      id: ID,
      type: { type: 'enum', valeurs: ['onglet', 'dossier'] },
      dossierId: opt(ID_OU_NUL),
      avant: opt(ID_OU_NUL),
      apres: opt(ID_OU_NUL),
      epingle: opt(OUI)
    }),
    fn: (ctx, p) => ctx.etat.appliquer('deplacer', p)
  },
  'onglet.epingler': { schema: objet({ id: ID, oui: OUI }), fn: (ctx, { id, oui }) => ctx.etat.appliquer('epingler', id, oui) },
  'onglet.dupliquer': {
    schema: objet({ id: ID }),
    fn: (ctx, { id }) => {
      const o = ctx.etat.lire().onglets.find((x) => x.id === id);
      if (o) ctx.onglets.ouvrir(o.espaceId, o.url, { apres: o.epingle ? null : id, actif: true });
    }
  },
  'onglet.muet': {
    schema: objet({ id: ID, oui: OUI }),
    fn: (ctx, { id, oui }) => {
      ctx.etat.appliquer('majMeta', id, { muet: oui });
      ctx.onglets.webContentsDe(id)?.setAudioMuted(oui);
    }
  },

  'dossier.creer': {
    schema: objet({ espaceId: opt(ID), parentId: opt(ID_OU_NUL), nom: NOM }),
    fn: (ctx, { espaceId, parentId = null, nom }) =>
      ctx.etat.appliquer('ajouterDossier', { espaceId: espaceId || ctx.etat.lire().espaceActif, parentId, nom })
        .deltas[0].dossier.id
  },
  'dossier.renommer': { schema: objet({ id: ID, nom: NOM }), fn: (ctx, { id, nom }) => ctx.etat.appliquer('modifierDossier', id, { nom }) },
  'dossier.replier': { schema: objet({ id: ID, oui: OUI }), fn: (ctx, { id, oui }) => ctx.etat.appliquer('modifierDossier', id, { replie: oui }) },
  'dossier.supprimer': { schema: objet({ id: ID }), fn: (ctx, { id }) => ctx.etat.appliquer('supprimerDossier', id) },
  'dossier.teinte': {
    schema: objet({ id: ID, teinte: TEINTE }),
    fn: (ctx, { id, teinte }) => {
      if (!teinteValide(teinte)) throw new Error('payload-invalide: teinte');
      ctx.etat.appliquer('modifierDossier', id, { teinte });
    }
  },

  'espace.creer': {
    schema: objet({ nom: NOM, teinte: opt(TEINTE), icone: opt({ type: 'string', max: 16, nul: true }) }),
    fn: (ctx, { nom, teinte = null, icone = null }) => {
      if (!teinteValide(teinte)) throw new Error('payload-invalide: teinte');
      const id = ctx.etat.appliquer('ajouterEspace', { nom, teinte, icone }).deltas[0].espace.id;
      ctx.etat.appliquer('activerEspace', id);
      return id;
    }
  },
  'espace.activer': { schema: objet({ id: ID }), fn: (ctx, { id }) => ctx.etat.appliquer('activerEspace', id) },
  'espace.modifier': {
    schema: objet({ id: ID, nom: opt(NOM), teinte: opt(TEINTE), icone: opt({ type: 'string', max: 16, nul: true }) }),
    fn: (ctx, { id, ...patch }) => {
      if ('teinte' in patch && !teinteValide(patch.teinte)) throw new Error('payload-invalide: teinte');
      ctx.etat.appliquer('modifierEspace', id, patch);
    }
  },
  'espace.supprimer': { schema: objet({ id: ID }), fn: (ctx, { id }) => ctx.etat.appliquer('supprimerEspace', id) },

  'nav.precedent': { schema: RIEN, fn: (ctx) => wcCourant(ctx)?.navigationHistory.goBack() },
  'nav.suivant': { schema: RIEN, fn: (ctx) => wcCourant(ctx)?.navigationHistory.goForward() },
  'nav.recharger': {
    schema: objet({ sansCache: opt(OUI) }),
    fn: (ctx, { sansCache }) => (sansCache ? wcCourant(ctx)?.reloadIgnoringCache() : wcCourant(ctx)?.reload())
  },
  'nav.arreter': { schema: RIEN, fn: (ctx) => wcCourant(ctx)?.stop() },
  'nav.aller': {
    schema: objet({ url: URL_ }),
    fn: (ctx, { url }) => {
      const id = ctx.onglets.courantId();
      if (id) ctx.onglets.naviguer(id, url);
      else ctx.onglets.ouvrir(ctx.etat.lire().espaceActif, url, { actif: true });
    }
  },
  'page.chercher': {
    schema: objet({ texte: { type: 'string', max: 500 }, arriere: opt(OUI), fin: opt(OUI) }),
    fn: (ctx, { texte, arriere = false, fin = false }) => {
      const wc = wcCourant(ctx);
      if (!wc) return;
      if (fin || !texte) return wc.stopFindInPage('keepSelection');
      wc.findInPage(texte, { forward: !arriere, findNext: true });
    }
  },
  'page.zoom': {
    schema: objet({ sens: { type: 'enum', valeurs: ['plus', 'moins', 'normal'] } }),
    fn: (ctx, { sens }) => {
      const wc = wcCourant(ctx);
      if (!wc) return;
      const actuel = wc.getZoomFactor();
      let i = ZOOMS.findIndex((z) => z >= actuel - 0.001);
      if (i < 0) i = ZOOMS.length - 1;
      const cible = sens === 'normal' ? 1 : ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, sens === 'plus' ? i + 1 : i - 1))];
      wc.setZoomFactor(cible);
      const h = hote(wc.getURL());
      if (!h) return;
      const zoom = { ...ctx.etat.reglages().zoom };
      if (cible === 1) delete zoom[h];
      else zoom[h] = cible;
      ctx.etat.regler({ zoom });
    }
  },
  'commande.resoudre': {
    schema: objet({ texte: { type: 'string', max: 2000 } }),
    fn: (ctx, { texte }) => resoudre(texte, ctx.etat.lire(), ctx.historique, ctx.etat.reglages().moteur)
  },
  'commande.ouvrir': {
    schema: objet({
      type: { type: 'enum', valeurs: ['onglet', 'epingle', 'historique', 'url', 'recherche', 'suggestion'] },
      url: opt(URL_),
      id: opt(ID),
      nouvelOnglet: OUI
    }),
    fn: (ctx, { type, url, id, nouvelOnglet }) => {
      if ((type === 'onglet' || type === 'epingle') && id) return ctx.etat.appliquer('activer', id);
      const cible = type === 'suggestion' ? (MOTEURS[ctx.etat.reglages().moteur] || MOTEURS.google)(url || '') : url;
      if (!cible) return;
      if (nouvelOnglet || !ctx.onglets.courantId()) ctx.onglets.ouvrir(ctx.etat.lire().espaceActif, cible, { actif: true });
      else ctx.onglets.naviguer(ctx.onglets.courantId(), cible);
    }
  },
  'page.capture': {
    schema: RIEN,
    fn: (ctx) => (ctx.onglets.courantId() ? ctx.onglets.capturer(ctx.onglets.courantId()) : null)
  },
  'layout.zone': {
    schema: objet({ x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' } }),
    fn: (ctx, rect) => ctx.onglets.zone(rect)
  },
  'layout.overlay': { schema: objet({ actif: OUI }), fn: (ctx, { actif }) => ctx.onglets.setOverlay(actif) },
  'barre.replier': { schema: objet({ oui: OUI }), fn: (ctx, { oui }) => ctx.etat.regler({ barreRepliee: oui }) }
};

module.exports = { ACTIONS, ZOOMS };
