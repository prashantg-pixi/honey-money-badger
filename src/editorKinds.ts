/**
 * The document kinds this game's editor serves, as **plain data** (FR-PLAT-8, 03 §18.4, FR-EDIT-5).
 *
 * The editor's project service runs inside the dev server, in node, and it needs one thing from the
 * game before it can list, read or write anything: the set of `{ kind, extension, globs }` its
 * toolset declares. Nothing outside a declared glob is ever listed or written — that is one of the
 * four rules that make a dev-server write endpoint safe — so this table is the whole of what the
 * editor can reach in this repository.
 *
 * ## Why this is a hand-written copy rather than the real thing
 *
 * The real thing is `collectDocumentKinds(EDITOR_TOOLS)`, which is what the shell computes at boot.
 * It cannot be used here. `@veyra/vite-config`'s shim loads this module through
 * `server.ssrLoadModule` — in **node**, with no DOM, no WebGL and no audio context — and
 * `./editor.ts` imports twelve tool packages that reach the renderer, Spine and the audio backends
 * between them. Loading that graph to read nine names and their globs would either fail outright or
 * boot half a game inside the dev server.
 *
 * ## Why it imports nothing at all — not even a type
 *
 * `editor-only-from-a-game-editor-entry` in `.dependency-cruiser.cjs` is a **path** rule, and
 * dependency-cruiser runs with `tsPreCompilationDeps: true`. A type-only
 * `import type { ProjectKindGlobs } from '@veyra/editor'` is a module edge exactly as a value import
 * is, and would fail `pnpm boundaries` from this file just as loudly. So the shape is restated
 * below, structurally compatible with the shell's `ProjectKindGlobs`.
 *
 * ## What keeps the copy honest
 *
 * `editorKinds.test.ts` deep-equals this table against `collectDocumentKinds(EDITOR_TOOLS)` — the
 * real toolset, the real kinds, the real globs. Adding a tool, dropping one, or re-globbing a kind
 * fails that test on the same commit. Read it before editing this file: a change here that the test
 * does not also want is a change that will make the editor list the wrong files.
 *
 * ## This game owns no document yet, and the table is still not empty
 *
 * Honey Money Badger has authored no `.layout.json`, no `.symbols.json` and none of the other seven
 * — its only committed JSON is the offline target's `composition.json`, which is a build declaration
 * and not an editor document. So every kind below opens an empty Library panel today.
 *
 * That is the point rather than a gap. A kind is declared by the **tool**, not by the presence of a
 * file, so the service is already able to write the first one an author creates; the alternative —
 * declaring kinds as documents appear — would mean the editor could not create the very files it
 * exists to create. (Only `layoutTool` can create a file from inside the editor today; every other
 * kind is create-outside-then-open, which still needs the glob to be declared first.)
 */

/** One document kind, as the project service needs it. Mirrors the shell's `ProjectKindGlobs`. */
export interface EditorDocumentKind {
  /** The `kind` literal from 06 §8 — `'layout'`, `'strips'`, `'sequence'`, … */
  readonly kind: string;
  /**
   * The filename tail this kind owns, leading dot included.
   *
   * Carried even though the globs already imply it: the service's `write` path resolves a path to
   * its owning kind by **longest extension**, because every kind is `.<kind>.json` and a shorter
   * tail would otherwise shadow a longer one. Dropping this field does not fail a listing — it
   * fails a save, at the moment an author presses Ctrl+S.
   */
  readonly extension: string;
  /** Game-relative globs, POSIX separators. Nothing outside them is listed, read or written. */
  readonly globs: readonly string[];
}

/**
 * Every kind `EDITOR_TOOLS` declares, in the order the tools are composed.
 *
 * Nine kinds from twelve tools: `storyTool`, `assetsTool`, `platformTool` and `verifyTool` declare
 * no documents — a tool with panels and no format is legal and is what T0 and the read-only tools
 * are (03 §18.6, FR-EDIT-101). `.paylines.json` and `.paytable.json` are absent from every game's
 * table for a different reason: they have strict loaders and no declared `DocumentKind`
 * (FR-EDIT-31/32 unbuilt), so the editor cannot open them and this table must not pretend otherwise.
 */
export const EDITOR_DOCUMENT_KINDS: readonly EditorDocumentKind[] = [
  // `layoutTool()` — @veyra/editor-tool-layout, `layoutKind`. One document **per orientation**
  // (invariant 7), so both are matched and neither is derived from the other.
  { kind: 'layout', extension: '.layout.json', globs: ['src/**/*.layout.json'] },

  // `reelsTool()` — @veyra/editor-tool-reels, `symbolsKind` then `stripsKindFor(...)`, in that
  // order. A game has one of each, but both globs are written openly: the service lists what it
  // finds, and a game with a second table needs no change here.
  { kind: 'symbols', extension: '.symbols.json', globs: ['src/**/*.symbols.json'] },
  { kind: 'strips', extension: '.strips.json', globs: ['src/**/*.strips.json'] },

  // `timelineTool()` — @veyra/editor-tool-timeline, `sequenceKind`. The one abbreviated extension
  // in the repo: a `sequence` is `.seq.json` (06 §9).
  { kind: 'sequence', extension: '.seq.json', globs: ['src/**/*.seq.json'] },

  // `fxTool()` — @veyra/editor-tool-fx, `emitterKind`.
  { kind: 'emitter', extension: '.emitter.json', globs: ['src/**/*.emitter.json'] },

  // `audioTool()` — @veyra/editor-tool-audio, `cuesKindFor(...)`. Declared even though this game
  // composes the tool **without** a sprite map, because a bare `audioTool()` declares the same kind:
  // the glob is not what decides whether cues can be edited, the map is. See `editor.ts` for why
  // there is no map to pass yet.
  { kind: 'cues', extension: '.cues.json', globs: ['src/**/*.cues.json'] },

  // `fixturesTool()` — @veyra/editor-tool-fixtures, `outcomeKind`. Two spellings, because a game
  // keeps fixtures beside the code that plays them **and** a recorded library under the game root.
  {
    kind: 'outcome',
    extension: '.outcome.json',
    globs: ['src/**/__outcomes__/*.outcome.json', '__outcomes__/*.outcome.json'],
  },

  // `textTool()` — @veyra/editor-tool-text, `textStyleKind`.
  { kind: 'textstyle', extension: '.textstyle.json', globs: ['src/**/*.textstyle.json'] },

  // `skinTool()` — @veyra/editor-tool-skin, `skinKind`. **One document, both orientations** — the
  // opposite of `layout`, because a skin's `partLayout` carries a table per orientation inside it.
  { kind: 'skin', extension: '.skin.json', globs: ['src/**/*.skin.json'] },
];
