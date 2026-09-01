import { anchorTo, LayoutNode, type Size } from '@veyra/layout';
import { LayoutContainer } from '@veyra/layout-pixi';
import { createLogger } from '@veyra/logger';
import { formatMoney, type MoneyFormatOptions } from '@veyra/money';
import { ReelBoardView } from '@veyra/presentation-reels';
import type { SymbolRegistry } from '@veyra/presentation-symbols';
import { LineWinView, WinRollupView } from '@veyra/presentation-wins';
import { Container } from '@veyra/renderer';
import { computed, signal } from '@veyra/signals';
import { BetPanelView, ControlsView } from '@veyra/ui-kit';
import { GameTitleView } from '../components/GameTitleView';
import type { GameSession } from './session';

const log = createLogger('honey-money-badger:presentation');

/**
 * The **presentation layer** of Honey Money Badger: every view, laid out for exactly **one** design space
 * (1920×1080 or 1080×1920). The two orientations are independently authored, never derived from each
 * other by resize math (03 §8.1/§8.3, invariant 7) — this function runs once per orientation.
 *
 * It is rebuilt on an orientation swap while the {@link GameSession} beneath it — stores, Timeline,
 * Flow, presenters — persists, so a rebuilt view binds the live presenter signals and snaps to the
 * current round state. The logical round is never interrupted by a rotation (03 §8.8).
 *
 * Views take only read-only signals and layout config, and emit semantic intents. None of them sees a
 * Provider, a RoundDriver, a Book or the Timeline (invariant 4, FR-PRES-7).
 */
export interface GamePresentationOptions {
  /** Container the presentation root is added to (a stage root, or a bare container in tests). */
  readonly stage: Container;
  /** Design-space size to author in: 1920×1080 or 1080×1920. */
  readonly design: Size;
  /** Board grid, matching the fixture's board. */
  readonly reels: number;
  readonly rows: number;
  /** Symbol art. Falls back to tinted quads until real art is packed (see `symbols.ts`). */
  readonly registry: SymbolRegistry;
  /** Injected platform locale and currency display policy — never a build-time constant. */
  readonly moneyFormat: MoneyFormatOptions;
}

export interface GamePresentation {
  /** The presentation's own container (added to `stage`). */
  readonly root: Container;
  /** The board's world-space layout node (03 §8.5) — a `flyTo` target for win presentation. */
  readonly board: LayoutNode;
  /** The bet panel; the composition attaches keyboard controls to it, keeping DOM out of the views. */
  readonly betPanel: BetPanelView;
  /** Advance the view animations by one frame; `rate` is the session's effective playback rate. */
  tick(deltaMs: number, rate: number): void;
  dispose(): void;
}

export function buildPresentation(
  session: GameSession,
  options: GamePresentationOptions,
): GamePresentation {
  const { stage, design, reels, rows, registry } = options;
  const { stores } = session;

  const root = new Container();
  stage.addChild(root);

  // Design-space layout: the board fills most of the width, leaving head and foot room, centred.
  const cell = Math.floor(Math.min((design.w * 0.82) / reels, (design.h * 0.6) / rows));
  const gap = Math.round(cell * 0.06);
  const cellSize: Size = { w: cell, h: cell };
  const boardW = reels * cell + (reels - 1) * gap;
  const boardH = rows * cell + (rows - 1) * gap;
  const origin = anchorTo(
    { w: boardW, h: boardH },
    { x: 0, y: 0, w: design.w, h: design.h },
    { edge: 'center' },
  );

  // Re-root the board under a world-space LayoutContainer (03 §8.5): the container holds the
  // design-space origin, the reel and win views sit at its local (0,0), and Pixi composes the ancestor
  // chain — so a win symbol can `flyTo(board)` from any depth later on.
  const board = new LayoutContainer({
    node: new LayoutNode({ x: origin.x, y: origin.y, scale: 1 }),
  });
  root.addChild(board.view);

  const layout = { reels, rows, cell: cellSize, gap };
  const reelView = new ReelBoardView({
    registry,
    board: session.reels.board,
    spinning: session.reels.spinning,
    layout,
  });
  board.view.addChild(reelView.view);

  const winView = new LineWinView({ wins: session.wins.wins, layout });
  board.view.addChild(winView.view);

  // The count-up meter and tier banner below the board. The session supplies total and tier; the view
  // owns the count-up, advanced by `tick`. A reduced-motion player snaps it.
  const rollupView = new WinRollupView({
    total: session.wins.total,
    tier: session.wins.tier,
    width: Math.round(boardW * 0.9),
    reducedMotion: stores.settings.reducedMotion,
  });
  rollupView.view.position.set(design.w / 2, origin.y + boardH + Math.round(design.h * 0.11));
  root.addChild(rollupView.view);

  // The game's first component (scaffolded with its story) — replace it with real art when you have it.
  const title = new GameTitleView({
    label: signal('Honey Money Badger'),
    width: Math.round(boardW * 0.6),
  });
  title.view.position.set(design.w / 2, Math.round(design.h * 0.08));
  root.addChild(title.view);

  const canSpin = computed(() => stores.flow.state() === 'idle');
  const betPanel = new BetPanelView({
    intents: session.intents,
    displayBalance: stores.wallet.displayBalance,
    selectedStake: stores.bet.selectedStake,
    canSpin,
    width: Math.round(design.w * 0.86),
    legalStakes: stores.bet.config.stakes,
    formatMoney: (value) => formatMoney(value, options.moneyFormat),
  });
  betPanel.view.position.set(design.w / 2, design.h - Math.round(design.h * 0.09));
  root.addChild(betPanel.view);

  // Turbo + autospin, above the bet panel. Autospin is gated on the provider's `autoplay` capability.
  const controls = new ControlsView({
    intents: session.intents,
    turbo: stores.ui.turbo,
    autospinRemaining: stores.ui.autospinRemaining,
    autoplay: session.capabilities?.autoplay ?? false,
    width: Math.round(design.w * 0.42),
  });
  controls.view.position.set(design.w / 2, design.h - Math.round(design.h * 0.17));
  root.addChild(controls.view);

  let disposed = false;
  return {
    root,
    board: board.node,
    betPanel,
    tick(deltaMs, rate) {
      if (disposed) return;
      reelView.tick(deltaMs * rate);
      rollupView.tick(deltaMs * rate);
      title.tick(deltaMs * rate);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      // Leaves first (each detaches its view), then the board container, then the root. Every member is
      // disposed in isolation: this teardown runs mid-round on an orientation swap, and one throwing
      // view must never strand the rest on the stage as a ghost board (invariant 10).
      const teardown: readonly { dispose(): void }[] = [
        reelView,
        winView,
        rollupView,
        title,
        betPanel,
        controls,
        board,
        { dispose: () => root.destroy({ children: true, texture: false, textureSource: false }) },
      ];
      for (const member of teardown) {
        try {
          member.dispose();
        } catch (error) {
          log.error('presentation member dispose threw; continuing teardown', error);
        }
      }
    },
  };
}
