import { defineConfig } from 'vite';
import path from 'node:path';

// Le preload du shell est sandboxé : il ne peut charger que `electron`. On le
// bundle pour y embarquer la barre d'extensions de electron-chrome-extensions.
const dir = import.meta.dirname;

export default defineConfig({
  build: {
    outDir: path.resolve(dir, 'src/preload/dist'),
    emptyOutDir: true,
    target: 'node24',
    minify: false,
    lib: { entry: path.resolve(dir, 'src/preload/shell.js'), formats: ['cjs'], fileName: () => 'shell.js' },
    rollupOptions: { external: ['electron'] }
  }
});
