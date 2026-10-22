/* Vérifie les cibles de performance de la spec (§5) sur le shell compilé. */
const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const racine = path.join(__dirname, '..');
execSync('npm run build', { cwd: racine, stdio: 'ignore' });
const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'escale-mesures-'));
const p = spawn(
  path.join(racine, 'node_modules/.bin/electron'),
  ['.', '--mesures', '--shell-dist', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', `--user-data-dir=${profil}`],
  { cwd: racine }
);
let sortie = '';
p.stdout.on('data', (d) => (sortie += d));
const limite = setTimeout(() => p.kill('SIGKILL'), 180_000);
p.on('exit', (code) => {
  clearTimeout(limite);
  fs.rmSync(profil, { recursive: true, force: true });
  const ligne = sortie.split('\n').find((l) => l.startsWith('MESURES '));
  if (!ligne) {
    console.error('Aucune mesure (délai dépassé ou plantage).');
    process.exit(1);
  }
  const m = JSON.parse(ligne.slice(8));
  const unites = { barreLateraleMs: 'ms', cmdTMs: 'ms', ipcReposKoParS: 'Ko/s', memoireMo: 'Mo' };
  for (const [k, max] of Object.entries(m.cibles)) {
    console.log(`${m.echecs.includes(k) ? '✖' : '✔'} ${k} : ${m[k]} ${unites[k]} (cible < ${max})`);
  }
  console.log(`  onglets vivants pendant la mesure mémoire : ${m.vivants}`);
  process.exit(code);
});
