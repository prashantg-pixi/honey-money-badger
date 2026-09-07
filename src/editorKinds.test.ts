/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { collectDocumentKinds, EDITOR_TOOLS } from './editor';
import { EDITOR_DOCUMENT_KINDS, type EditorDocumentKind } from './editorKinds';

/**
 * **The anti-drift rail for `editorKinds.ts`, and the reason that hand-written copy is allowed to
 * exist at all** (FR-PLAT-8, 03 §18.4, FR-EDIT-5).
 *
 * `editorKinds.ts` restates what `collectDocumentKinds(EDITOR_TOOLS)` computes at boot, because the
 * dev server has to read those kinds in **node** — `@veyra/vite-config` loads that module through
 * `server.ssrLoadModule` before it can serve a single request — and `./editor.ts` imports twelve
 * tool packages that reach the renderer, Spine and the audio backends between them.
 *
 * A restatement is only safe if something fails the day it stops matching, and nothing else in the
 * gate can notice. The two halves have no compile-time relationship: `editorKinds.ts` imports
 * nothing (a type import would fail `pnpm boundaries` — `editor-only-from-a-game-editor-entry` is a
 * path rule and dependency-cruiser runs with `tsPreCompilationDeps: true`), so `tsc` sees two
 * unrelated files. And the failure it guards against is **silent by construction**: a kind the
 * service has never heard of is not an error at any layer, it is a document tool whose Library panel
 * lists nothing — which in a game that owns no documents yet is indistinguishable from the correct
 * state. That is why this game needs the rail more than a game with a full table does, not less.
 *
 * So: add a tool, drop one, or re-glob a kind, and this fails on the same commit.
 *
 * The `happy-dom` environment is what lets this import `./editor` at all. It is not there so the
 * editor can boot — that entry's guard is `#editor`, and this document has no such element — it is
 * there because the twelve tool packages behind {@link EDITOR_TOOLS} construct their panels at
 * module scope and reach for DOM types on the way.
 */

/** Stable, locale-independent order, so the comparison survives a tool being re-composed. */
function byKind(a: EditorDocumentKind, b: EditorDocumentKind): number {
  if (a.kind < b.kind) return -1;
  return a.kind > b.kind ? 1 : 0;
}

/** Normalise to the plain shape, so `toEqual` compares data rather than loaders and serializers. */
function normalize(kinds: readonly EditorDocumentKind[]): EditorDocumentKind[] {
  return kinds
    .map((kind) => ({ kind: kind.kind, extension: kind.extension, globs: [...kind.globs] }))
    .sort(byKind);
}

describe('EDITOR_DOCUMENT_KINDS', () => {
  it('matches every kind the composed toolset declares, name, extension and globs', () => {
    // The real thing: the same call `runEditor` makes, over the same array `editor.html` boots.
    const declared = collectDocumentKinds(EDITOR_TOOLS).map((kind) => ({
      kind: kind.kind,
      extension: kind.extension,
      // `globs` is optional on a `DocumentKind`; the assertion below is what refuses one without.
      globs: [...(kind.globs ?? [])],
    }));

    expect(normalize(EDITOR_DOCUMENT_KINDS)).toEqual(normalize(declared));
  });

  it('declares a kind even though this game owns no document of any of them', () => {
    // The property that makes the table useful before a single file exists: a kind is declared by
    // the tool, not by a file on disk, so the service can write the first document an author
    // creates. An empty table would type-check, pass a glob-shape check, and leave the editor unable
    // to save anything — the exact failure this game had before the service was installed at all.
    expect(EDITOR_DOCUMENT_KINDS.length).toBeGreaterThan(0);
  });

  it('gives every kind at least one glob, because a kind without one can never be listed', () => {
    // Not a restatement of the test above: it would pass with both sides empty. The project service
    // reaches a file only through a declared glob, so a kind that declares none is a tool whose
    // documents cannot be opened — and nothing about that is loud on its own.
    for (const kind of EDITOR_DOCUMENT_KINDS) {
      expect(kind.globs.length, `document kind "${kind.kind}" declares no globs`).toBeGreaterThan(
        0,
      );
      for (const glob of kind.globs) {
        // POSIX and game-relative is the only path shape that crosses this boundary; the service
        // refuses a backslash or a leading slash outright (`assertSafeProjectPath`), so a glob that
        // could only ever match one of those would be a glob that matches nothing.
        expect(glob.startsWith('/')).toBe(false);
        expect(glob.includes('\\')).toBe(false);
        expect(glob.endsWith(kind.extension)).toBe(true);
      }
    }
  });
});
