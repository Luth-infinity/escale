/* Lance Escale en mode banc de sécurité, dans un profil jetable. */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'escale-securite-'));
const electron = path.join(racine, 'node_modules/.bin/electron');
const p = spawn(electron, ['.', '--test-securite', `--user-data-dir=${profil}`], { cwd: racine });
let sortie = '';
p.stdout.on('data', (d) => (sortie += d));
p.stderr.on('data', () => {});
const limite = setTimeout(() => p.kill('SIGKILL'), 120_000);
p.on('exit', (code) => {
  clearTimeout(limite);
  const ligne = sortie.split('\n').find((l) => l.startsWith('RESULTATS '));
  if (!ligne) {
    console.error('Aucun résultat (délai dépassé ou plantage).');
    process.exit(1);
  }
  for (const r of JSON.parse(ligne.slice(10))) console.log(`${r.ok ? '✔' : '✖'} ${r.nom} — ${r.detail}`);
  fs.rmSync(profil, { recursive: true, force: true });
  process.exit(code);
});
