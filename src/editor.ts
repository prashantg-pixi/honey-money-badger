import { runEditor, type EditorTool } from '@veyra/editor';
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
  audioTool(),
  fixturesTool(),
  textTool(),
  skinTool(),
  assetsTool(),
  platformTool(),
  verifyTool(),
];

/** Boot, but only in a browser — a composition root runs when something mounts it. */
if (typeof document !== 'undefined') {
  runEditor({ tools: EDITOR_TOOLS });
}
