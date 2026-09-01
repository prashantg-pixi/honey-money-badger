import type { Story } from '@veyra/devkit';
import { gameTitleViewStory, gameTitleViewWideStory } from '../components/GameTitleView.story';

/**
 * Every Testing-Ground story for Honey Money Badger. Add a component's `*.story.ts` exports here to list it
 * in the sidebar.
 *
 * Engine stories are importable too — `@veyra/ui-kit/stories`, `@veyra/presentation-reels/stories`,
 * `@veyra/presentation-wins/stories` and friends each export ready-made stories that need no game art,
 * which is the fastest way to see the shared views before this game has any of its own.
 */
export const stories: Story[] = [gameTitleViewStory, gameTitleViewWideStory];
