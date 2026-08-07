import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const resolve = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/**
 * Three processes, three builds.
 *
 * `main` is Node and privileged. `preload` is an isolated wire. `renderer` is a
 * browser and must never resolve a `node:` import — the build is what catches
 * that, rather than review.
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@cocoapilot/contract': resolve('../../packages/contract/src/index.ts') } },
    build: {
      lib: { entry: resolve('./src/main/app.ts') },
      outDir: 'out/main',
      // CommonJS, even though this package is `"type": "module"`. Electron's
      // built-in `electron` module is registered with its patched CJS loader; an
      // ESM bundle resolves the npm shim instead, which exports a path string
      // rather than the API. `.cjs` is what makes the format explicit to Node.
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'app.cjs' } },
    },
  },

  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: resolve('./src/preload/index.ts') },
      outDir: 'out/preload',
      // A sandboxed preload cannot be an ES module.
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.cjs' } },
    },
  },

  renderer: {
    root: resolve('./src/renderer'),
    plugins: [react()],
    build: {
      outDir: resolve('./out/renderer'),
      rollupOptions: { input: resolve('./src/renderer/index.html') },
    },
  },
});
