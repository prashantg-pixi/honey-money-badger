# Honey Money Badger

A Veyra slot game, scaffolded by `veyra-scaffold game honey-money-badger`. It **plays a round right now**,
offline: no backend, no Book schema, no network (invariant 6, FR-PROV-1).

Read [`docs/design`](../../docs/design) in the engine repo before changing anything — start at
`00-overview.md`, then `01-principles.md`. The invariants there are load-bearing, not style.

## Run it

```sh
pnpm install                                    # from the engine repo root
pnpm --filter @veyra/game-honey-money-badger assets   # pack raw-assets/ -> public/assets/
pnpm --filter @veyra/game-honey-money-badger dev      # http://localhost:5173
```

- `/` — the `offline` target, with the dev overlay (05 §11) available in dev only.
- `/testing-ground.html` — the Testing Ground: every story in isolation, both orientations (05 §4).

```sh
pnpm --filter @veyra/game-honey-money-badger build           # every declared target -> dist/<target>/
pnpm --filter @veyra/game-honey-money-badger typecheck
pnpm test                                              # from the engine root: goldens, leaks, allocation
```

## What is here

```
src/game/fixtures.ts       the hand-authored offline round — canonical RoundUpdates, not a mock
src/game/symbols.ts        the symbol vocabulary fixtures, math and art all share
src/game/session.ts        one Timeline, one Flow, the stores, intent routing
src/game/presentation.ts   the views for ONE orientation; rebuilt on rotation, round untouched
src/game/boot.ts           platform-agnostic assembly — selects no platform
src/game/startTarget.ts    the shared launch sequence every target runs
src/platforms/offline/  the one target: main.ts, integration.ts, composition.json
src/components/            components, each with its colocated story and golden test
src/stories/index.ts       the story list the Testing Ground sidebar shows
raw-assets/                source art; `pnpm assets` packs it into public/assets/
```

## Add a component

```sh
pnpm --filter @veyra/tool-create-veyra-game scaffold -- component WinBanner --dir games/honey-money-badger/src/components
```

You get the class, its colocated `.story.ts` and its golden test — which is the definition of done for
a component (05 §12). Register the story in `src/stories/index.ts` so the sidebar lists it.

## Add a platform target

The scaffold emits only `offline`, because it is the one target that needs nothing external. To add
another, copy `src/platforms/offline/` to `src/platforms/<name>/`, change **only** the selection in
`integration.ts` and the declaration in `composition.json`, and add `<name>` to `veyra.targets.json`:

- **`replay`** — `ReplayRoundDriver` over a recorded fixture library (see `veyra-record`). Wallet-inert:
  no `recoveryScope`, because there is no real round to resume.
- **`rest`** — `@veyra/provider-rest` plus `@veyra/host-web`, with the deployment's base URL and the one
  exact operator origin read from `import.meta.env` (declare them in `src/vite-env.d.ts`).

Shared game code must never branch on a platform name or import a composition root (FR-PLAT-3): a target
is a _selection_, injected downward. `games/sugar-fortune` in the engine repo is the worked example.

## Grow it

1. **Real art** — drop frames into `raw-assets/sprites{m}/symbols/` named after the ids in
   `src/game/symbols.ts`, run `pnpm assets`, and load the bundle in `boot.ts` with `AssetSystem` +
   `registry.primeTextures(...)`. Everything else is unchanged.
2. **A multi-segment round** — add `automatic` continuations in `fixtures.ts` and swap
   `completeRoundFixture` for `sequenceRoundFixture`. The Timeline, presenters and views do not change
   (invariant 3).
3. **Real math** — when a backend exists, write its Adapter, map its Book to canonical `RoundUpdate`s,
   and add a target that selects it. The offline target stays as the dev mode and the regression rail.
