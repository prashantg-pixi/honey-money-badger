import { requireMount, startTarget } from '../../game/startTarget';
import { createOfflineHost, createOfflineIntegration, OFFLINE_RECOVERY_SCOPE } from './integration';

// Honey Money Badger — `offline` platform composition root (FR-PLAT-1). The selection itself lives in
// `integration.ts`, so the per-target suites exercise the shipped wiring; this file adds the browser
// concerns and is the only place the dev overlay can be reached. Shared game code never imports from
// here and never branches on a platform name (FR-PLAT-3, invariant 11).
//
// No backend, no Book schema, no network: the primary dev mode (principle A6, FR-PROV-1).

const handle = await startTarget({
  mount: requireMount(),
  host: createOfflineHost(() => window.close()),
  // A durable journal scoped to this artifact: a mid-round reload boot-recovers exactly once.
  recoveryScope: OFFLINE_RECOVERY_SCOPE,
  createIntegration: () => createOfflineIntegration(),
});

// Dev-only runtime overlay (05 §11). The dynamic import behind `import.meta.env.DEV` keeps
// `@veyra/devtools` out of the production module graph — Vite tree-shakes it, and the prod-clean gate
// proves its absence. The overlay reads the live game via `handle.debug()` and drives cheats through
// the provider.
if (import.meta.env.DEV) {
  const { attachDevtools } = await import('@veyra/devtools');
  attachDevtools(() => handle.debug());
}
