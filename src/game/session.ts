import type {
  BetConfig,
  ProviderCapabilities,
  RoundDriver,
  WalletSnapshot,
} from '@veyra/contracts';
import { Flow } from '@veyra/flow';
import { IntentChannel } from '@veyra/intent';
import { compareMoney } from '@veyra/money';
import { ReelPresenter } from '@veyra/presentation-reels';
import { WinEscalationPresenter, WinPresenter } from '@veyra/presentation-wins';
import { createEphemeralJournal, type RequestJournal } from '@veyra/provider-core';
import { createStores, type SettingsStore, type Stores } from '@veyra/stores';
import { Timeline } from '@veyra/timeline';

/**
 * The **session layer** of Honey Money Badger: everything whose lifetime is the whole running game rather
 * than one orientation. Stores, the one persistent {@link Timeline}, the one {@link Flow} over one
 * journal (invariant 3 — one logical round, one Timeline), the Timeline-bound presenters, and the
 * intent channel plus its routing.
 *
 * An orientation change rebuilds only the **presentation** layer on top of this (`presentation.ts`),
 * so rotating mid-round never interrupts the round (03 §8.8).
 */

/** Timeline rate when turbo is on. Turbo is playback rate, never a re-timed fixture (invariant 3). */
const TURBO_RATE = 3;

export interface GameSessionOptions {
  /** The platform's round driver — the offline fixture driver in this target (FR-PLAT-1). */
  readonly roundDriver: RoundDriver;
  /**
   * Durable request/recovery journal. A real target injects a store-backed journal and calls
   * `flow.recover()` at boot, so a round interrupted by a reload resumes exactly once. Omitted → a
   * non-durable in-session journal: every spin still journals persist-before-transport.
   */
  readonly journal?: RequestJournal;
  readonly initialWallet: WalletSnapshot;
  readonly betConfig: BetConfig;
  /** Persisted player settings — shared with the composition, never rebuilt on rotation. */
  readonly settings?: SettingsStore;
  /** Provider capabilities (FR-PROV-6) — the UI gates controls such as autospin on these. */
  readonly capabilities?: ProviderCapabilities;
}

export interface GameSession {
  readonly stores: Stores;
  readonly timeline: Timeline;
  readonly flow: Flow;
  /** The semantic-intent channel Views emit to; the dev overlay drives spins through it too. */
  readonly intents: IntentChannel;
  readonly reels: ReelPresenter;
  readonly wins: WinPresenter;
  /** The tiered-celebration port: tier, sequence and the beat the Timeline cursor is in. */
  readonly escalation: WinEscalationPresenter;
  readonly capabilities: ProviderCapabilities | undefined;
  /** Advance one frame of logical time; returns the effective rate so views scale identically. */
  advance(deltaMs: number): number;
  /** Launch the next autospin round when idle with rounds remaining and a balance that covers it. */
  pumpAutospin(): void;
  dispose(): void;
}

export function createGameSession(options: GameSessionOptions): GameSession {
  const timeline = new Timeline();
  const stores = createStores({
    wallet: options.initialWallet,
    betConfig: options.betConfig,
    ...(options.settings !== undefined ? { settings: options.settings } : {}),
  });
  const flow = new Flow({
    roundDriver: options.roundDriver,
    timeline,
    journal: options.journal ?? createEphemeralJournal(),
    stores: { bet: stores.bet, wallet: stores.wallet, flow: stores.flow },
  });

  const reels = new ReelPresenter(timeline);
  // The tier is classified against the **presented round's** stake, republished by Flow from the
  // RoundUpdate it applied — never `stores.bet.selectedStake`, which is the *live* bet: replaying an
  // archived round after the player changed stake would otherwise re-band the same Outcome, banner,
  // sound and golden frame (FR-PRES-21/27, 03 §13.1).
  const wins = new WinPresenter(timeline, { stake: flow.roundStake });
  // The escalation port reads the same Timeline and the tier the classifier already published; its
  // coin shower is seeded from the round's own segment seed (FR-PRES-23/26).
  const escalation = new WinEscalationPresenter(timeline, {
    tier: wins.tier,
    seed: flow.presentationSeed,
  });

  // The semantic-intent seam (03 §4.2): views emit intents, and this is the ONE place that routes them
  // to Flow / stores. A view never touches Flow or a Provider (invariant 4). Routing is session-owned,
  // so a presentation rebuild can neither drop it nor subscribe it twice.
  const intents = new IntentChannel();
  const routeIntents = intents.subscribe((intent) => {
    switch (intent.kind) {
      case 'spinRequested':
        void flow.spin();
        break;
      case 'skipRequested':
        flow.skip();
        break;
      case 'turboToggled':
        stores.ui.setTurbo(!stores.ui.turbo.peek());
        break;
      case 'autospinRequested':
        stores.ui.startAutospin(intent.count);
        break;
      case 'autospinStopped':
        stores.ui.stopAutospin();
        break;
      case 'stakeChanged':
        stores.bet.selectStake(intent.stake);
        break;
      case 'retryRequested':
        void flow.retry(); // re-send the exact durable request after a retryable failure
        break;
      case 'resumeRequested':
        void flow.resume(); // reconcile from durable state and rebuild the one Timeline
        break;
      default:
        break;
    }
  });

  let disposed = false;
  return {
    stores,
    timeline,
    flow,
    intents,
    reels,
    wins,
    escalation,
    capabilities: options.capabilities,
    advance(deltaMs) {
      if (disposed) return 1;
      // Turbo = Timeline rate; re-assert it each frame because `reset()` clears it per spin.
      const rate = stores.ui.turbo.peek() ? TURBO_RATE : 1;
      if (timeline.rate !== rate) timeline.setRate(rate);
      timeline.advance(deltaMs);
      // Presenters that read the cursor sample it here, once, straight after the Timeline moved —
      // never from a clock of their own (FR-PRES-28).
      escalation.sample();
      return rate;
    },
    pumpAutospin() {
      if (disposed) return;
      if (stores.flow.state.peek() !== 'idle') return;
      if (stores.ui.autospinRemaining.peek() <= 0) return;
      const balance = stores.wallet.displayBalance.peek();
      if (compareMoney(balance, stores.bet.selectedStake.peek()) < 0) {
        stores.ui.stopAutospin();
        return;
      }
      stores.ui.consumeAutospin();
      void flow.spin();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      routeIntents(); // stop routing before the machinery goes down…
      intents.dispose();
      flow.dispose();
      reels.dispose();
      escalation.dispose();
      wins.dispose();
      timeline.dispose();
    },
  };
}
