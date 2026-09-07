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
// ## The editor's project service, and why it is installed by naming modules rather than importing
//
// FR-PLAT-8's `defineVeyraGame({ editor })` is wired below, and it takes **two module ids** rather
// than a plugin. That is not a stylistic preference; it is the only shape that works from here.
//
// A config is loaded by Vite's own config loader, which bundles it with esbuild and then
// externalises every bare import and hands it to **node** — and node cannot load a workspace
// package's TypeScript source. Every `@veyra/*` package ships `src/*.ts` through `exports` with no
// build step, so `import { veyraEditorPlugin } from '@veyra/editor/vite'` here throws
// `Unknown file extension ".ts"` before the config finishes loading. `@veyra/vite-config` is
// importable at all only because it is the one package that ships hand-written JavaScript. Making
// the import dynamic does not help: the production path stops loading it and every *other* consumer
// of this config still breaks, because they load it with no `VEYRA_TARGET` and so take the dev
// branch — `pnpm i18n` was the one that caught that.
//
// So the loading is deferred to **Vite** instead of node. `@veyra/vite-config` builds the plugin —
// a plugin is plain data, so node has no trouble with it — registers its middleware synchronously,
// and on the first request pulls both modules named below through `server.ssrLoadModule`, which
// transpiles TypeScript and resolves workspace packages exactly as it does for the game's own
// source. **The implementation therefore stays TypeScript**: `packages/editor/shell/src/vite.ts` is
// 480 typechecked lines carrying the path-safety, loopback-host and declared-glob checks that are
// the only thing making a dev-server *write* endpoint safe, and rewriting them as hand-written
// JavaScript to satisfy a module loader would be a trade against exactly the code that must not be
// got wrong.
//
// `editorKinds` is a separate, **import-free data module** rather than `src/editor.ts`, because
// `ssrLoadModule` runs in node: loading the editor entry would pull twelve tool packages and,
// through them, the renderer, Spine and the audio backends into the dev server. It is a restatement
// of what the toolset declares, and `src/editorKinds.test.ts` deep-equals it against
// `collectDocumentKinds(EDITOR_TOOLS)` so it cannot drift.
//
// None of this reaches a build. The plugin declares `apply: 'serve'`, so Vite does not instantiate
// it for a build; `defineVeyraTarget` above has no `editor` option at all; and prod-clean asserts
// the absence of the editor and the packages behind it in every artifact (FR-PLAT-4/5, 07 B3 row 34).
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

  const app = defineVeyraGame({
    base: './',
    outDir: 'dist/editor',
    editor: {
      // The document kinds this game's toolset serves. Root-relative, so Vite resolves it against
      // the game directory rather than against whatever the command was run from.
      kinds: '/src/editorKinds.ts',
      // The project service implementation (03 §18.4, FR-EDIT-5). Named by the game rather than
      // hard-coded in `@veyra/vite-config`, so that package declares no dependency on the editor —
      // a `config/*` package depending on a `packages/*` one would invert the layering.
      service: '@veyra/editor/vite',
    },
  });
  // Spread rather than replace: `defineVeyraGame({ editor })` returns a `plugins` array, and only
  // `build` is being narrowed here to the one dev entry.
  return {
    ...app,
    build: {
      ...app.build,
      rollupOptions: { input: { editor: 'editor.html' } },
    },
  };
};
