import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineVeyraGame, defineVeyraTarget } from '@veyra/vite-config';
import { TARGET_ENV } from '@veyra/vite-config/build-targets';

const gameRoot = fileURLToPath(new URL('.', import.meta.url));

// Independent builds, never one shared `rollupOptions.input` (FR-PLAT-2/4):
//
// - **Production targets** — when `veyra-build-targets` runs `vite build` with `VEYRA_TARGET=<name>`,
//   build that target alone from its own directory (`src/platforms/<name>/index.html` →
//   `./main.ts`) into an isolated `dist/<name>/`. Pointing Vite's `root` at the target directory is
//   what makes each artifact emit a plain `index.html`; the shared `public/` asset dir and the output
//   dir are therefore given absolutely. Every other target and the editor are absent.
// - **Dev** — a plain build with no `VEYRA_TARGET` builds only the dev entry (`editor.html`) into
//   `dist/editor/`. The dev server serves the game root, so `/index.html` (the offline target),
//   `/src/platforms/<name>/index.html` and `/editor.html` are all reachable while developing. The
//   Testing Ground entry is gone (FR-EDIT-17): `storyTool` mounts the same stories inside the
//   editor, so the harness became one panel rather than a second application.
//
// The editor's project service is **not** installed, and cannot be — a config is resolved by node,
// and node cannot load a workspace package's TypeScript source. FR-PLAT-8's option exists and no
// game can pass one; see Chipmunk Heist's config for the long form.
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

  const app = defineVeyraGame({ base: './', outDir: 'dist/editor' });
  return {
    ...app,
    build: {
      ...app.build,
      rollupOptions: { input: { editor: 'editor.html' } },
    },
  };
};
