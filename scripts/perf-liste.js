/* Outil de dev : 300 onglets, puis défilement de la liste mesuré frame par frame. */
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function perfListe({ fenetre, etat }) {
  const esp = etat.lire().espaceActif;
  for (let i = 0; i < 300; i++) etat.appliquer('ouvrirOnglet', { espaceId: esp, url: `https://exemple${i}.fr/page` });
  await attendre(2500);
  const r = await fenetre.webContents.executeJavaScript(`new Promise((fin) => {
    const liste = document.querySelector('aside .overflow-y-auto');
    const max = liste.scrollHeight - liste.clientHeight;
    const durees = []; let prec = performance.now(); const t0 = prec;
    (function f() {
      const t = performance.now(); durees.push(t - prec); prec = t;
      const p = Math.min(1, (t - t0) / 2000);
      liste.scrollTop = max * (p < 0.5 ? 2 * p : 2 - 2 * p);
      if (p < 1) requestAnimationFrame(f); else {
        durees.shift(); durees.sort((a, b) => a - b);
        fin({ frames: durees.length, mediane: durees[durees.length >> 1].toFixed(1), p95: durees[Math.floor(durees.length * 0.95)].toFixed(1), max: durees.at(-1).toFixed(1), lignesDom: liste.querySelectorAll('[style*="top"]').length, hauteur: max });
      }
    })();
  })`);
  console.log('PERF', JSON.stringify(r));
  require('electron').app.exit(0);
};
