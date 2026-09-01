import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineVeyraApp, defineVeyraTarget } from '@veyra/vite-config';
import { TARGET_ENV } from '@veyra/vite-config/build-targets';

const gameRoot = fileURLToPath(new URL('.', import.meta.url));

// Independent builds, never one shared `rollupOptions.input` (FR-PLAT-2/4):
//
// - **Production targets** — when `veyra-build-targets` runs `vite build` with `VEYRA_TARGET=<name>`,
//   build that target alone from its own directory (`src/platforms/<name>/index.html` →
//   `./main.ts`) into an isolated `dist/<name>/`. Pointing Vite's `root` at the target directory is
//   what makes each artifact emit a plain `index.html`; the shared `public/` asset dir and the output
//   dir are therefore given absolutely. Every other target and the Testing Ground are absent.
// - **Dev / Testing Ground** — a plain `vite build` (no `VEYRA_TARGET`) builds only the dev entry
//   (`testing-ground.html`) into `dist/testing-ground/`. `vite` (dev) serves the game root, so
//   `/index.html` (the offline target), `/src/platforms/<name>/index.html` and the Testing Ground are
//   all reachable while developing.
export default () => {
  const target = process.env[TARGET_ENV];
  if (target !== undefined && target !== '') {
    return defineVeyraTarget({
      target,
      root: resolve(gameRoot, 'src/platforms', target),
      publicDir: resolve(gameRoot, 'public'),
      outDir: resolve(gameRoot, 'dist', target),
    });
  }

  const app = defineVeyraApp({ base: './', outDir: 'dist/testing-ground' });
  return {
    ...app,
    build: {
      ...app.build,
      rollupOptions: { input: { 'testing-ground': 'testing-ground.html' } },
    },
  };
};
