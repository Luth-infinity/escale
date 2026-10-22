const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

/**
 * L'historique : une ligne par page (pages), une par visite (visites), et un
 * index plein texte FTS5 sur l'URL et le titre (recherche, même rowid que
 * pages). SQLite plutôt que JSON : l'historique grossit sans fin et la barre
 * de commande l'interroge à chaque frappe.
 */
function ouvrir(chemin) {
  fs.closeSync(fs.openSync(chemin, 'a', 0o600));
  fs.chmodSync(chemin, 0o600);
  const db = new DatabaseSync(chemin);
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (id INTEGER PRIMARY KEY, url TEXT UNIQUE NOT NULL, titre TEXT NOT NULL DEFAULT '',
      visites INTEGER NOT NULL DEFAULT 0, derniere INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS visites (url TEXT NOT NULL, quand INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS visites_quand ON visites(quand);
    CREATE VIRTUAL TABLE IF NOT EXISTS recherche USING fts5(url, titre);
  `);
  const q = {
    page: db.prepare(`INSERT INTO pages (url, titre, visites, derniere) VALUES (?, ?, 1, ?)
      ON CONFLICT(url) DO UPDATE SET titre = excluded.titre, visites = visites + 1, derniere = max(derniere, excluded.derniere)
      RETURNING id, titre`),
    visite: db.prepare('INSERT INTO visites (url, quand) VALUES (?, ?)'),
    oublier: db.prepare('DELETE FROM recherche WHERE rowid = ?'),
    indexer: db.prepare('INSERT INTO recherche (rowid, url, titre) VALUES (?, ?, ?)'),
    chercher: db.prepare(`SELECT p.url, p.titre, p.visites, p.derniere FROM recherche r JOIN pages p ON p.id = r.rowid
      WHERE recherche MATCH ? ORDER BY p.visites DESC, p.derniere DESC LIMIT ?`)
  };

  function noterVisite(url, titre, quand = Date.now()) {
    const { id } = q.page.get(url, titre || '', quand);
    q.visite.run(url, quand);
    q.oublier.run(id);
    q.indexer.run(id, url, titre || '');
  }

  function chercher(texte, limite = 8) {
    // Chaque mot devient un préfixe entre guillemets : la syntaxe FTS5 tapée
    // par l'utilisateur (", *, NEAR…) ne doit jamais être interprétée.
    const mots = String(texte).toLowerCase().match(/[\p{L}\p{N}]+/gu);
    if (!mots) return [];
    return q.chercher.all(mots.map((m) => `"${m}"*`).join(' '), limite).map((r) => ({ ...r }));
  }

  function effacer(depuis = 0) {
    db.exec('BEGIN');
    db.prepare('DELETE FROM visites WHERE quand >= ?').run(depuis);
    db.exec(`
      DELETE FROM pages WHERE url NOT IN (SELECT url FROM visites);
      UPDATE pages SET visites = (SELECT count(*) FROM visites v WHERE v.url = pages.url),
                       derniere = (SELECT max(quand) FROM visites v WHERE v.url = pages.url);
      DELETE FROM recherche WHERE rowid NOT IN (SELECT id FROM pages);
      COMMIT;
      VACUUM;
    `);
  }

  return { noterVisite, chercher, effacer, fermer: () => db.close() };
}

module.exports = { ouvrir };
