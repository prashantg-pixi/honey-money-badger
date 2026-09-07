import { collectDocumentKinds, runEditor, type EditorTool } from '@veyra/editor';
import { assetsTool } from '@veyra/editor-tool-assets';
import { audioTool } from '@veyra/editor-tool-audio';
import { fixturesTool } from '@veyra/editor-tool-fixtures';
import { fxTool } from '@veyra/editor-tool-fx';
import { layoutTool } from '@veyra/editor-tool-layout';
import { platformTool } from '@veyra/editor-tool-platform';
import { reelsTool } from '@veyra/editor-tool-reels';
import { skinTool } from '@veyra/editor-tool-skin';
import { storyTool } from '@veyra/editor-tool-story';
import { textTool } from '@veyra/editor-tool-text';
import { timelineTool } from '@veyra/editor-tool-timeline';
import { verifyTool } from '@veyra/editor-tool-verify';
import { stories } from './stories';

/**
 * Honey Money Badger's **editor entry** — the composition root for the slot editor (03 §18.5, FR-EDIT-7).
 *
 * Dev-only, served at `/editor.html`, never in a production artifact, and the only file in this game
 * permitted to import the editor (`editor-only-from-a-game-editor-entry` says so by path).
 *
 * **This game is a scaffold and has no authored tables yet**, which is exactly why it gets the editor
 * now rather than later. Every tool is composed; most open nothing, because the declared globs match
 * no file. That is the intended shape of a new game (`parallel-games-delivery.md`): the tools are the
 * baseline a game inherits, and a document appears when someone authors one — not after a separate
 * adoption step each game would otherwise have to remember to run.
 *
 * The Testing Ground entry is retired with it (FR-EDIT-17): `storyTool` mounts the same stories in
 * the same devkit transport, so the harness became one panel rather than a second application.
 *
 * ## The project service is installed now, and that is a change in kind
 *
 * Until this commit `vite.config.ts` passed no `editor` option, so every `list`, `read` and `write`
 * the editor issued fell through Vite's SPA fallback and came back as `index.html` — the editor
 * booted, showed its panels, and could open or save nothing. For a game with no documents that
 * looked exactly like the correct empty state, which is why it survived so long here.
 * `editorKinds.ts` and the `defineVeyraGame({ editor })` block are the two halves of the fix
 * (FR-PLAT-8); `editorKinds.test.ts` is what stops the first half drifting from this array.
 */

// The AssetPack output is served under `assets/` (public/assets/), so manifest URLs resolve there
// rather than at the document root.
const BASE_PATH = 'assets/';

export const EDITOR_TOOLS: readonly EditorTool[] = [
  storyTool({ stories, basePath: BASE_PATH }),
  layoutTool(),
  reelsTool(),
  timelineTool(),
  fxTool(),
  // T5 — cues, composed **without** a sprite map, because this game has no audiosprite to pass:
  // there is no `raw-assets/audio/` here, so there are no packed clips and no generated definition.
  // The consequence is worth stating plainly rather than leaving to be discovered: **a `.cues.json`
  // cannot be opened in this game until it has one.** `cuesKind` refuses every load with
  // `MissingSpriteMapError`, which is the honest failure — the one rule only that loader can enforce
  // is that a binding names a cue the sprite actually contains, and without the sprite that check
  // cannot run. Half-validating the format would let a dangling binding through, and a dangling
  // binding is silent at runtime: the moment is simply quiet.
  //
  // When Sound delivers a sprite, this becomes `audioTool({ sprites: () => ({ [id]: definition }) })`
  // over a committed `raw-assets/audio/soundSprite.json` read as a module — Chipmunk Heist's entry
  // is the worked example. Name the clips in **kebab-case** when they are packed: `loadCues`
  // requires it (06 §9), and a snake_case sprite is a sprite whose every cue name a document is
  // forbidden to reference.
  audioTool(),
  fixturesTool(),
  textTool(),
  skinTool(),
  assetsTool(),
  platformTool(),
  verifyTool(),
];

/**
 * Boot, but only into the page that asked for an editor.
 *
 * The guard is `#editor` rather than "is there a `document`", and the difference is load-bearing in
 * two directions. A config file is evaluated in **node**, so a node import must not boot; and a
 * `happy-dom` test *has* a `document`, so "there is a DOM" is not the question — **"has a page
 * declared where the editor mounts"** is. `editor.html` carries `<div id="editor">` and every other
 * entry does not, which makes the mount point the same thing that selects the entry.
 *
 * This file previously guarded on `typeof document !== 'undefined'` alone, which meant any
 * `happy-dom` suite that imported the module for {@link EDITOR_TOOLS} booted a whole editor as a
 * side effect — `editorKinds.test.ts` is exactly such a suite, and it is why the guard is narrowed
 * here rather than left as it was.
 */
if (typeof document !== 'undefined' && document.getElementById('editor') !== null) {
  runEditor({ tools: EDITOR_TOOLS });
}

/**
 * The editor's own surface, re-published from the one module allowed to import it.
 *
 * `editor-only-from-a-game-editor-entry` is a **path** rule, and dependency-cruiser runs with
 * `tsPreCompilationDeps: true` — so an `import type { … } from '@veyra/editor'` anywhere else in
 * this game is a violation exactly as a value import is, which is right: a type import is still a
 * module edge, and a rule that let one through would be a rule about syntax rather than the graph.
 *
 * `collectDocumentKinds` is here for one specific reader: `editorKinds.ts` is a hand-written copy of
 * what this toolset declares, because the dev server has to read it in node without loading the
 * renderer, and `editorKinds.test.ts` is what stops that copy drifting. It can only compare against
 * the real thing if the real thing is reachable, and this module is the only one allowed to reach
 * it.
 *
 * None of this reaches a production artifact. `veyra-build-targets` emits one entry per declared
 * target and this is not one of them, and prod-clean asserts the absence of the editor and every
 * package behind it in what is built (FR-PLAT-4/5, 07 B3 row 34).
 */
export { collectDocumentKinds };
