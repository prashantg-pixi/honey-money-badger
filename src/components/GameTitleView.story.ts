import { story, type StoryContext } from '@veyra/devkit';
import { signal } from '@veyra/signals';
import { GameTitleView } from './GameTitleView';

/**
 * Colocated stories for `GameTitleView` (05 §2). A story mounts **exactly one** component with
 * only the assets it declares and no game boot — that is the whole inner loop, and it is why a
 * component without a story is not done (05 §12).
 *
 * These two place the entrance pop at fixed logical points, so the golden frames differ and prove the
 * animation actually advances. Both are sized from `ctx.screen`, so the same story is authored for
 * landscape and portrait without a second coordinate table (invariant 7).
 *
 * `assets: []` — this component draws procedurally, so it needs no AssetPack bundle. When it starts
 * using real art, declare just that bundle here and the Testing Ground loads only it (05 §3, FR-DEV-3).
 */

const POP_MS = 320;

function mountGameTitleView(ctx: StoryContext, options: { readonly wide: boolean }): void {
  const { scope, registry, stage, screen } = ctx;
  const label = signal(options.wide ? 'game-title-view — wide' : 'game-title-view');

  const view = new GameTitleView({
    label,
    width: Math.round(Math.min(screen.width, screen.height) * (options.wide ? 0.8 : 0.45)),
    popMs: POP_MS,
  });
  view.view.position.set(screen.width / 2, screen.height / 2);
  stage.addChild(view.view);

  // The devkit's leak rail watches tracked resources across mount/unmount cycles; the scope owns the
  // teardown, so unmounting frees everything this story created (invariant 10).
  registry.track(view);
  scope.add(() => {
    registry.release(view);
    view.dispose();
  });

  // Fixed logical time, never a clock: the wide variant sits at the peak of the pop, the base variant
  // at rest. Deterministic in both orientations, so the golden frames are stable (invariant 2).
  if (options.wide) view.tick(POP_MS / 2);
  else view.finishPop();
}

/**
 * The component at rest. Story ids are `<group>/<Component>` with the variant appended in PascalCase
 * and the resting state unsuffixed (06 §10); `game/` is this game's own group — rename it to whatever
 * area the component belongs to, but never to the reserved `devkit/`.
 */
export const gameTitleViewStory = story('game/GameTitleView', {
  assets: [],
  mount: (ctx) => mountGameTitleView(ctx, { wide: false }),
});

/** A wider instance caught mid-pop — a different frame, which is what makes the golden meaningful. */
export const gameTitleViewWideStory = story('game/GameTitleViewWide', {
  assets: [],
  mount: (ctx) => mountGameTitleView(ctx, { wide: true }),
});
