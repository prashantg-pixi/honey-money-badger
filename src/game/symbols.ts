import { createSymbolRegistry, type SymbolRegistry } from '@veyra/presentation-symbols';

/**
 * Honey Money Badger's symbol vocabulary. Fixtures, win evaluation and art all speak these ids, so there is
 * exactly one place to change when the set changes.
 *
 * Each descriptor carries a placeholder `color` **and** an `alias`. The alias is the spritesheet frame
 * name the registry prefers once `raw-assets/` holds real art and `pnpm assets` has packed it; until
 * then — and always in the headless golden, which has no GPU — the registry falls back to the tinted
 * quad. The same round therefore hashes deterministically with or without art (03 §7.2), which is what
 * lets the whole game be built and tested before a single symbol is drawn.
 */
export const GAME_SYMBOLS: readonly { id: string; color: number }[] = [
  { id: 'hp1', color: 0xe23b3b },
  { id: 'mp1', color: 0xe2853b },
  { id: 'mp2', color: 0xe2c23b },
  { id: 'lp1', color: 0x3ba2e2 },
  { id: 'lp2', color: 0x3b5ae2 },
  { id: 'wild', color: 0xf5f5f5 },
  { id: 'scatter', color: 0xf5c542 },
];

/** A registry of this game's symbols, each aliasing the spritesheet frame of the same name. */
export function createGameSymbolRegistry(): SymbolRegistry {
  return createSymbolRegistry(GAME_SYMBOLS.map((s) => ({ ...s, alias: s.id })));
}
