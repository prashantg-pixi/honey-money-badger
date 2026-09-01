// Honey Money Badger — Testing Ground entry. Dev-only harness: boots the shared devkit runner with this
// game's stories so any component can be inspected in isolation, in both orientations, with no game
// boot (05 §4). Served by Vite at /testing-ground.html.
//
// Run: `pnpm --filter @veyra/game-honey-money-badger dev`
import { runTestingGround } from '@veyra/devkit';
import { stories } from './stories';

// basePath: the AssetPack output is served under `assets/` (public/assets/), so manifest URLs resolve
// there rather than at the document root. Run `pnpm assets` at least once before `pnpm dev`.
void runTestingGround({ stories, basePath: 'assets/' });
