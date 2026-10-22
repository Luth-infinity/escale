import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const dir = import.meta.dirname;

export default defineConfig({
  root: path.resolve(dir, 'src/renderer'),
  // Chemins relatifs : la page est chargée via file:// dans l'app packagée.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(dir, 'src/renderer/src') } },
  // 5373 et pas 5273 : Hublink et Escale doivent pouvoir tourner en même temps.
  server: { port: 5373, strictPort: true },
  build: { outDir: path.resolve(dir, 'src/renderer/dist'), emptyOutDir: true, target: 'chrome146' }
});
