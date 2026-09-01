import type { Host } from '@veyra/host';
import { StandaloneHost } from '@veyra/host-standalone';
import { OfflineProvider, OfflineRoundDriver } from '@veyra/provider-offline';
import {
  demoRoundFixture,
  GAME_BET_CONFIG,
  GAME_CURRENCY,
  GAME_OPENING_WALLET,
} from '../../game/fixtures';
import type { TargetIntegration } from '../../game/startTarget';

/**
 * The `offline` target's **selection**, kept DOM-free so a per-target conformance suite can exercise
 * the exact wiring the artifact ships (FR-PLAT-5). `main.ts` adds only the browser concerns: the mount
 * and the dev overlay.
 */

/** Durable recovery scope for this artifact; namespaced so no other target can resume its rounds. */
export const OFFLINE_RECOVERY_SCOPE = 'honey-money-badger.offline';

/**
 * There is no operator container, so the host resolves configured launch facts locally. Being
 * standalone it installs no `message` listener at all — the offline artifact has no cross-window
 * attack surface to defend (FR-HOST-1).
 */
export function createOfflineHost(onClose?: () => void): Host {
  return new StandaloneHost({
    locale: 'en-US',
    mode: 'fun',
    currency: GAME_CURRENCY.code,
    ...(onClose !== undefined ? { onClose } : {}),
  });
}

/**
 * The offline dev integration — the primary development mode (principle A6, FR-PROV-1). No network, no
 * Book schema: the driver replays a hand-authored canonical fixture.
 *
 * Cheats are enabled (05 §11.4): the overlay's cheat panel forces an outcome *through the provider*,
 * never fabricated on the client (invariant 1). The `recoveryWallet` is what makes the driver
 * recovery-capable — because the fixture *is* the committed round, a fresh instance after a reload can
 * answer `recoverRound`, so boot-recover resumes it exactly once.
 */
export function createOfflineIntegration(): TargetIntegration {
  return {
    provider: new OfflineProvider({
      wallet: GAME_OPENING_WALLET,
      betConfig: GAME_BET_CONFIG,
      capabilities: { cheats: true },
    }),
    roundDriver: new OfflineRoundDriver(demoRoundFixture(), {
      recoveryWallet: GAME_OPENING_WALLET,
    }),
  };
}
