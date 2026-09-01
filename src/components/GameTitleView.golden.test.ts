import { fileURLToPath } from 'node:url';
import { assertNoLeak, renderStoryFrame } from '@veyra/devkit';
import { checkGoldenFrames, GoldenStore } from '@veyra/devkit/golden';
import { describe, expect, it } from 'vitest';
import { gameTitleViewStory, gameTitleViewWideStory } from './GameTitleView.story';

/**
 * The headless half of the definition of done (05 §12, FR-DEV-7/8): the same stories that mount in the
 * Testing Ground render in Node with no browser and no GPU, and their frames are hashed per
 * orientation. The first run **records** the goldens into `__golden__/`; commit them, and every later
 * run **matches** — a rendering change then shows up as a failing hash rather than a bug in production.
 */

const store = new GoldenStore(fileURLToPath(new URL('./__golden__', import.meta.url)));
const stories = [gameTitleViewStory, gameTitleViewWideStory];

describe('GameTitleView golden + leak', () => {
  it('captures a golden frame per orientation for each story', () => {
    const results = stories.flatMap((s) => checkGoldenFrames(s, store));
    expect(results).toHaveLength(4);
    for (const result of results) expect(['matched', 'recorded']).toContain(result.status);
  });

  it('authors landscape and portrait independently', () => {
    for (const s of stories) {
      expect(renderStoryFrame(s, 'landscape')).not.toBe(renderStoryFrame(s, 'portrait'));
    }
  });

  it('shows the mid-pop variant differently from the settled one', () => {
    expect(renderStoryFrame(gameTitleViewWideStory, 'landscape')).not.toBe(
      renderStoryFrame(gameTitleViewStory, 'landscape'),
    );
  });

  it('passes the leak rail across mount/unmount cycles', () => {
    for (const s of stories) expect(assertNoLeak(s).ok).toBe(true);
  });
});
