import {
  parseBetConfig,
  type BetConfig,
  type Board,
  type RoundUpdate,
  type WalletSnapshot,
  type WinEvent,
} from '@veyra/contracts';
import {
  addMoney,
  createCurrency,
  createMinorUnits,
  createMoney,
  subtractMoney,
  type MinorUnits,
  type Money,
} from '@veyra/money';
import { completeRoundFixture } from '@veyra/provider-offline';

/**
 * The hand-authored offline round for Honey Money Badger — the whole reason this game plays with **no
 * backend and no Book schema** (invariant 6, FR-PROV-1). It is not a mock of a server: it is a
 * canonical `RoundUpdate[]`, the exact shape a real platform's Adapter will one day produce, so the
 * game you build against it is the game a real integration drives.
 *
 * This is the **complete-book cadence**: one segment whose continuation is `complete`, so `startRound`
 * delivers the entire round at once. When your math delivers a round in pieces, add updates with
 * `automatic` continuations before the closing one and swap `completeRoundFixture` for
 * `sequenceRoundFixture` — Flow follows each continuation with `continueRound` and the Timeline,
 * presenters and views are unchanged (03 §4.1, invariant 3).
 *
 * Every amount here is exact minor units through `@veyra/money`; there is no `number` arithmetic on
 * money anywhere in a Veyra game (07 A14).
 */

/** A fun-money currency for offline play. A real integration takes its currency from the launch. */
export const GAME_CURRENCY = createCurrency('FUN', 2);

export const GAME_STAKE = createMoney(createMinorUnits(100), GAME_CURRENCY);

export const GAME_BET_STEPS: readonly Money[] = [100, 200, 500, 1_000, 2_000].map((minorUnits) =>
  createMoney(createMinorUnits(minorUnits), GAME_CURRENCY),
);

/** The opening balance the offline provider is authoritative for (invariant 1: the client never sets it). */
export const GAME_OPENING_WALLET: WalletSnapshot = {
  balance: createMoney(createMinorUnits(100_000), GAME_CURRENCY),
  revision: 'offline-opening',
};

/** The immutable legal bet configuration; `parseBetConfig` validates it at the boundary (07 B7). */
export const GAME_BET_CONFIG: BetConfig = parseBetConfig({
  currency: GAME_CURRENCY,
  stakes: GAME_BET_STEPS,
  defaultStake: GAME_STAKE,
});

export const ROUND_ID = 'honey-money-badger-demo';
export const WIN_SYMBOL = 'hp1';
export const WIN_AMOUNT = createMinorUnits(1_000);

/** The 5×3 landed board (`symbols[reel][row]`). Reels 0–2, middle row are `hp1` — the paying line. */
export const DEMO_BOARD: Board = {
  reels: 5,
  rows: 3,
  symbols: [
    ['lp1', 'hp1', 'lp2'],
    ['mp1', 'hp1', 'lp1'],
    ['wild', 'hp1', 'mp2'],
    ['lp2', 'mp1', 'scatter'],
    ['mp2', 'lp1', 'wild'],
  ],
};

/** The middle-row three-of-a-kind the fixture pays. */
const WIN: WinEvent = {
  kind: 'win',
  winKind: 'line',
  symbol: WIN_SYMBOL,
  amount: WIN_AMOUNT,
  line: 1,
  positions: [
    { reel: 0, row: 1 },
    { reel: 1, row: 1 },
    { reel: 2, row: 1 },
  ],
};

/** The authoritative wallet after the wager is taken and the payout credited. */
function walletAfter(wager: Money, payout: MinorUnits): WalletSnapshot {
  return {
    balance: addMoney(
      subtractMoney(GAME_OPENING_WALLET.balance, wager),
      createMoney(payout, GAME_CURRENCY),
    ),
    revision: `${ROUND_ID}-final`,
  };
}

/**
 * The demo round: reveal the board, pay the line, credit the balance, close the round. Build a fresh
 * fixture per driver — a `RoundUpdate` is immutable, but the array is the driver's to own.
 */
export function demoRoundFixture(): RoundUpdate[] {
  return completeRoundFixture({
    roundId: ROUND_ID,
    currency: GAME_CURRENCY,
    stake: GAME_STAKE.minorUnits,
    wager: GAME_STAKE.minorUnits,
    segment: {
      index: 0,
      board: DEMO_BOARD,
      events: [{ kind: 'reveal', board: DEMO_BOARD }, WIN],
      payoutDelta: WIN_AMOUNT,
    },
    continuation: { kind: 'complete' },
    wallet: walletAfter(GAME_STAKE, WIN_AMOUNT),
  });
}
