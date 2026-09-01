import type {
  BetConfig,
  ProviderCapabilities,
  RoundDriver,
  WalletSnapshot,
} from '@veyra/contracts';
import { createApp } from '@veyra/core';
import { createStage } from '@veyra/layout';
import { StageRoot } from '@veyra/layout-pixi';
import { createLogger } from '@veyra/logger';
import type { MoneyFormatOptions } from '@veyra/money';
import type { RequestJournal } from '@veyra/provider-core';
import { effect } from '@veyra/signals';
import { SettingsStore, type SettingsStorage } from '@veyra/stores';
import { ResizeSystem } from '@veyra/system-resize';
import { attachKeyboardControls } from '@veyra/ui-kit';
import { DEMO_BOARD } from './fixtures';
import { buildPresentation, type GamePresentation } from './presentation';
import { createGameSession, type GameSession } from './session';
import { createGameSymbolRegistry } from './symbols';

const log = createLogger('honey-money-badger');

/**
 * Shared game boot for Honey Money Badger — platform-agnostic assembly. It selects **no** platform,
 * provider or dev tool (FR-PLAT-1/3): a composition root (`src/platforms/<target>/main.ts`) supplies
 * the `roundDriver` and calls this. There is no `@veyra/devtools` import here, because this code ships
 * to production.
 *
 * Note what boot does **not** do: fetch a manifest or load a bundle. The symbol registry falls back to
 * tinted quads, so the game plays with no network at all (invariant 6). Add asset loading here when
 * `raw-assets/` holds real art — see `README.md`.
 */

/** The two reference design spaces this game is authored in (03 §8.1, FR-LAY-1/2). */
const DESIGN = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
} as const;

export interface GameBootOptions {
  /** DOM element the renderer canvas is appended to. Owned by the caller (the composition root). */
  readonly mount: HTMLElement;
  /** The platform's round driver — the offline fixture driver in this target (FR-PLAT-1). */
  readonly roundDriver: RoundDriver;
  /**
   * Durable request/recovery journal. When the platform supplies a store-backed journal, boot calls
   * `flow.recover()` once after the first presentation is built, so a round interrupted by a reload
   * resumes exactly once. Omitted → an in-session journal with no cross-reload resume.
   */
  readonly journal?: RequestJournal;
  /** Opening provider-authoritative wallet and immutable legal bet configuration. */
  readonly initialWallet: WalletSnapshot;
  readonly betConfig: BetConfig;
  /** Platform/host locale and currency display policy. */
  readonly moneyFormat: MoneyFormatOptions;
  /** Provider capabilities (FR-PROV-6) — the UI gates controls on these. */
  readonly capabilities: ProviderCapabilities;
}

/**
 * A live handle onto the running game for the **dev overlay only** (05 §11). Built from the persistent
 * {@link GameSession}, so it stays valid across orientation rebuilds. Being plain data it never pulls
 * devtools into the bundle — the overlay attach is `import.meta.env.DEV`-gated in the composition root
 * and tree-shaken out of production.
 */
export interface GameDebug {
  readonly stores: GameSession['stores'];
  readonly timeline: GameSession['timeline'];
  readonly flow: GameSession['flow'];
  readonly intents: GameSession['intents'];
  readonly roundDriver: RoundDriver;
  readonly capabilities: ProviderCapabilities;
}

export interface GameHandle {
  /** The live debug handle; session-backed, so it survives orientation rebuilds. */
  debug(): GameDebug;
  /**
   * Tear the whole game down — renderer, session, presentation and every window listener — by
   * disposing the one app ownership scope (03 §7.2). A browser target rarely calls this; a container
   * that unmounts the game, and the leak baselines, do.
   */
  dispose(): void;
}

/** Boot the shared game onto `mount`. No platform selection — the composition root supplies that. */
export async function bootGame(options: GameBootOptions): Promise<GameHandle> {
  const { mount, roundDriver, initialWallet } = options;
  const app = await createApp({ background: '#101018' });
  mount.appendChild(app.renderer.canvas as unknown as HTMLCanvasElement);

  const registry = createGameSymbolRegistry();

  // Persist player preferences once per running game and share the store across orientation rebuilds
  // (FR-SYS-5). `localStorage` is injected structurally; a container that blocks it degrades safely.
  let settingsStorage: SettingsStorage | undefined;
  try {
    settingsStorage = window.localStorage;
  } catch {
    settingsStorage = undefined;
  }
  const prefersReducedMotion =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  const settings = new SettingsStore({
    ...(settingsStorage !== undefined ? { storage: settingsStorage } : {}),
    key: 'honey-money-badger.settings.v1',
    defaults: { reducedMotion: prefersReducedMotion },
  });

  // Resize as signals; the host advances it and ResizeSystem reads no DOM (FR-LAY-5). Besides `resize`,
  // listen to `orientationchange` with a rAF re-read — some mobile browsers deliver the rotate event
  // while `innerWidth`/`innerHeight` still hold the pre-rotation values (duplicates are no-ops).
  const resize = new ResizeSystem({ design: DESIGN });
  const applyViewport = (): void =>
    resize.setViewport({ w: window.innerWidth, h: window.innerHeight });
  const reapplyViewport = (): void => {
    applyViewport();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(applyViewport);
  };
  window.addEventListener('resize', applyViewport);
  window.addEventListener('orientationchange', reapplyViewport);
  app.root.add(() => {
    window.removeEventListener('resize', applyViewport);
    window.removeEventListener('orientationchange', reapplyViewport);
  });
  applyViewport();

  // The design-space stage (03 §8.1/§8.6): one reactive contain-fit transform for the active
  // orientation. `StageRoot` mirrors it onto a Pixi root, so content authored at mockup coordinates is
  // uniform-scaled and re-centred on any resize with no per-element math (invariant 7).
  const stage = createStage(resize, { design: DESIGN, layers: { game: { fit: 'contain' } } });
  const stageRoot = new StageRoot({ transform: stage.layer('game') });
  app.stage.addChild(stageRoot.view);
  app.root.add(stageRoot);
  const root = stageRoot.view;

  // The session — stores, one Timeline, one Flow over one journal, presenters, intent routing — is
  // created ONCE and survives every orientation swap (invariant 3: one logical round, one Timeline).
  const session = createGameSession({
    roundDriver,
    initialWallet,
    betConfig: options.betConfig,
    settings,
    capabilities: options.capabilities,
    ...(options.journal !== undefined ? { journal: options.journal } : {}),
  });
  app.root.add(() => session.dispose());

  // Orientation is a swap of the presentation only (03 §8.3/§8.8): dispose the old views, build the
  // independently-authored layout at the new design, re-attach keyboard controls. Both halves are
  // guarded — a throwing member is logged and contained, never a stranded ghost board on the stage.
  let presentation: GamePresentation | undefined;
  let keyboardOff: (() => void) | undefined;
  const buildForOrientation = (): void => {
    const design = resize.design.peek();
    keyboardOff?.();
    keyboardOff = undefined;
    try {
      presentation?.dispose();
    } catch (error) {
      log.error('presentation dispose failed during orientation swap; continuing', error);
    }
    presentation = undefined;
    try {
      const next = buildPresentation(session, {
        stage: root,
        design,
        reels: DEMO_BOARD.reels,
        rows: DEMO_BOARD.rows,
        registry,
        moneyFormat: options.moneyFormat,
      });
      presentation = next;
      keyboardOff = attachKeyboardControls(next.betPanel, window);
    } catch (error) {
      log.error('presentation rebuild failed; the session/round is unaffected', error);
    }
  };
  app.root.add(
    effect(() => {
      resize.orientation(); // subscribe: rebuild on an orientation swap
      buildForOrientation();
    }),
  );
  app.root.add(() => {
    keyboardOff?.();
    presentation?.dispose();
  });

  // Boot-recover: with a durable journal, reconcile any round interrupted by a reload before the player
  // can act — the one session Flow rebuilds the one Timeline from durable state and resumes it exactly
  // once. A no-op on a clean idle boot, or with the ephemeral in-session default.
  void session.flow.recover();

  // One frame of logical time per renderer tick: Timeline playback, then view animations at the
  // effective rate, then the autospin pump.
  app.renderer.app.ticker.add((ticker) => {
    const rate = session.advance(ticker.deltaMS);
    presentation?.tick(ticker.deltaMS, rate);
    session.pumpAutospin();
  });

  log.info('Honey Money Badger ready — spin via the bet panel or Enter');

  return {
    debug: () => ({
      stores: session.stores,
      timeline: session.timeline,
      flow: session.flow,
      intents: session.intents,
      roundDriver,
      capabilities: options.capabilities,
    }),
    dispose: () => app.dispose(),
  };
}
