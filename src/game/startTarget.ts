import type { BetConfig, Provider, RoundDriver, WalletSnapshot } from '@veyra/contracts';
import { redactLaunchContext, type Host, type LaunchContext } from '@veyra/host';
import { createLogger } from '@veyra/logger';
import { RequestJournal } from '@veyra/provider-core';
import { BrowserRecoveryStore, createBrowserRecoveryLock } from '@veyra/stores';
import { bootGame, type GameHandle } from './boot';

const log = createLogger('honey-money-badger:target');

/**
 * The **shared half of composition** (FR-PLAT-1). Every platform target performs the same launch
 * sequence: initialize the host, build its integration from the validated launch facts, open a durable
 * journal, read the authoritative opening wallet and bet config, and boot the shared game.
 *
 * Only the *selection* differs, and that is what a target root owns. This module deliberately imports
 * no concrete host or provider — every implementation arrives as a parameter — so it can be shared by
 * all targets without any of them leaking into another's artifact (FR-PLAT-2/3, invariant 11).
 */

/** The pair of ports a target selects: the session/wallet side and the request-cycle side. */
export interface TargetIntegration {
  readonly provider: Provider;
  readonly roundDriver: RoundDriver;
  /** Release integration-owned resources (a transport's in-flight requests, a socket). */
  readonly dispose?: () => void;
}

export interface StartTargetOptions {
  /** DOM element the renderer canvas is appended to. */
  readonly mount: HTMLElement;
  /** The target's selected host, **not** yet initialized — the handshake runs here. */
  readonly host: Host;
  /**
   * Build the target's integration from the validated launch facts. Runs after the handshake because a
   * real integration authenticates with `launch.sessionReference`; that token goes here and nowhere
   * else (NFR-SEC-1).
   */
  readonly createIntegration: (
    launch: LaunchContext,
  ) => TargetIntegration | Promise<TargetIntegration>;
  /**
   * Durable recovery scope, namespaced per target so two artifacts served from one origin can never
   * resume each other's rounds. Omitted → no durable journal (the in-session default).
   */
  readonly recoveryScope?: string;
}

/**
 * Open the durable request/recovery journal for a target, or `undefined` where the browser withholds
 * either capability (some embedded/headless containers). Falling back costs cross-reload resume only —
 * the game still plays, and every other durability guarantee is unchanged.
 */
async function createDurableJournal(sessionId: string): Promise<RequestJournal | undefined> {
  const locks = navigator.locks as LockManager | undefined;
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  if (storage === undefined || locks === undefined) {
    log.warn('durable recovery unavailable in this container; cross-reload resume is disabled');
    return undefined;
  }
  const store = await BrowserRecoveryStore.create({
    sessionId,
    storage,
    lock: createBrowserRecoveryLock(locks),
  });
  return new RequestJournal(store);
}

/** Fail loud when the operator launched a currency the provider's bet configuration cannot honor. */
function assertLaunchCurrency(
  launch: LaunchContext,
  betConfig: BetConfig,
  wallet: WalletSnapshot,
): void {
  const mismatch = [betConfig.currency.code, wallet.balance.currency.code].find(
    (code) => code !== launch.currency,
  );
  if (mismatch !== undefined) {
    throw new Error(
      `launch currency ${launch.currency} does not match the provider's ${mismatch}; refusing to start.`,
    );
  }
}

/** Run one target's launch sequence and boot the shared game. Resolves once the game is playable. */
export async function startTarget(options: StartTargetOptions): Promise<GameHandle> {
  const launch = await options.host.initialize();
  // The redacted view is the only launch shape that may reach a log sink — `sessionReference` is a
  // credential for the Provider edge alone (FR-HOST-4, NFR-SEC-1).
  log.info('launch context accepted', redactLaunchContext(launch));

  const integration = await options.createIntegration(launch);
  const { provider, roundDriver } = integration;
  const [wallet, betConfig, journal] = await Promise.all([
    provider.getWallet(),
    provider.getBetConfig(),
    options.recoveryScope === undefined
      ? Promise.resolve(undefined)
      : createDurableJournal(options.recoveryScope),
  ]);
  assertLaunchCurrency(launch, betConfig, wallet);

  const handle = await bootGame({
    mount: options.mount,
    roundDriver,
    ...(journal !== undefined ? { journal } : {}),
    initialWallet: wallet,
    betConfig,
    moneyFormat: {
      // Display policy follows the operator's launch locale — never a build-time constant.
      locale: launch.locale,
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    },
    capabilities: provider.capabilities,
  });

  // Ownership order on teardown: the game scope first, then the host transport, then the integration's
  // own resources — nothing is left mid-request (invariant 10).
  return {
    debug: () => handle.debug(),
    dispose() {
      handle.dispose();
      options.host.dispose();
      integration.dispose?.();
    },
  };
}

/** Resolve the target's mount element, failing loud when the container HTML is wrong. */
export function requireMount(id = 'app'): HTMLElement {
  const mount = document.getElementById(id);
  if (mount === null) throw new Error(`target root: missing #${id} mount element`);
  return mount;
}
