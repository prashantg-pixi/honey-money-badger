import { Scope, type Disposable } from '@veyra/core';
import { buildTextStyle, Container, Sprite, Text, Texture } from '@veyra/renderer';
import { effect, type ReadonlySignal } from '@veyra/signals';

/** Peak extra scale the banner reaches at the midpoint of its entrance pop. */
const POP_AMPLITUDE = 0.18;

/** How long the entrance pop takes, in logical ms. */
const DEFAULT_POP_MS = 320;

const DEFAULT_COLOR = 0xffd23b;

export interface GameTitleViewOptions {
  /** The label to show. A signal, so the same binding path a real game uses drives it live. */
  readonly label: ReadonlySignal<string>;
  /** Width in design-space pixels (03 §8.1 — author at mockup coordinates, never at device sizes). */
  readonly width: number;
  /** Height in design-space pixels. Defaults to a proportion of the width. */
  readonly height?: number;
  /** Fill colour. */
  readonly color?: number;
  /** Entrance-pop duration in logical ms. */
  readonly popMs?: number;
  /** Snap past the entrance pop (a `reduced-motion` player). */
  readonly reducedMotion?: boolean | ReadonlySignal<boolean>;
}

/**
 * `GameTitleView` — a scaffolded View.
 *
 * It is written the way every Veyra View is written, and the shape is the point:
 *
 * - **Signals in, nothing out.** It reads read-only signals and renders them. It never writes outcome
 *   state upward and never touches a Provider, RoundDriver, Flow or the Timeline (invariant 4).
 * - **Pixi only through `@veyra/renderer`.** A direct `pixi.js` import fails the gate (invariant 9).
 * - **Owned and disposable.** Everything it creates lives on its {@link Scope}; `dispose()` frees the
 *   subtree deterministically, and `mount → unmount` returns to baseline (invariant 10).
 * - **Animation lives here, driven by `tick(deltaMs)`.** It reads no clock of its own — logical time
 *   arrives from the caller, so the same story renders the same frame every run (invariant 2).
 * - **No allocation in the steady state.** `#paint` re-assigns text only when the shown value changes.
 *
 * Replace the placeholder rectangle with real art; keep the structure.
 */
export class GameTitleView implements Disposable {
  /** The root; add it to a design-space stage and position it there. */
  readonly view = new Container();

  readonly #scope = new Scope();
  readonly #options: GameTitleViewOptions;
  readonly #panel: Sprite;
  readonly #label: Text;
  readonly #width: number;
  readonly #height: number;
  readonly #popMs: number;
  #elapsedMs = 0;
  #shown = '';
  #disposed = false;

  constructor(options: GameTitleViewOptions) {
    this.#options = options;
    this.#width = options.width;
    this.#height = options.height ?? Math.round(options.width * 0.28);
    this.#popMs = options.popMs ?? DEFAULT_POP_MS;

    this.#panel = new Sprite(Texture.WHITE);
    this.#panel.anchor.set(0.5);
    this.#panel.tint = options.color ?? DEFAULT_COLOR;

    this.#label = new Text({
      text: '',
      style: buildTextStyle({
        fontFamily: 'monospace',
        fontSize: Math.round(this.#height * 0.42),
        fill: '#1c1c24',
        align: 'center',
      }),
    });
    this.#label.anchor.set(0.5);
    this.view.addChild(this.#panel, this.#label);

    // Re-render whenever the label (or the reduced-motion preference) changes. Reading the signal here
    // is what subscribes the effect; the scope owns the subscription so dispose stops it.
    this.#scope.add(
      effect(() => {
        this.#options.label();
        if (typeof this.#options.reducedMotion !== 'boolean') this.#options.reducedMotion?.();
        if (this.#reducedMotion) this.finishPop();
        this.#paint();
      }),
    );
    this.#paint(); // initial render, before the first flush
  }

  get #reducedMotion(): boolean {
    const reduced = this.#options.reducedMotion;
    return typeof reduced === 'boolean' ? reduced : (reduced?.peek() ?? false);
  }

  /** Advance the entrance pop by `deltaMs` of logical time and repaint. The tick loop drives this. */
  tick(deltaMs: number): void {
    if (this.#disposed) return;
    this.#elapsedMs = Math.min(this.#elapsedMs + deltaMs, this.#popMs);
    this.#paint();
  }

  /** Snap the entrance pop straight to rest (a live skip, or a reduced-motion player). */
  finishPop(): void {
    this.#elapsedMs = this.#popMs;
    this.#paint();
  }

  #paint(): void {
    // A single half-sine hump: 0 at the start, 1 at the midpoint, 0 at rest. Deterministic in `deltaMs`,
    // so a story that ticks to a fixed point hashes to the same golden frame every run.
    const progress = this.#popMs === 0 ? 1 : this.#elapsedMs / this.#popMs;
    const pop = 1 + POP_AMPLITUDE * Math.sin(Math.PI * progress);
    this.#panel.width = this.#width * pop;
    this.#panel.height = this.#height * pop;
    this.#label.scale.set(pop);

    const label = this.#options.label.peek();
    if (label !== this.#shown) {
      this.#shown = label;
      this.#label.text = label;
    }
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#scope.dispose(); // stops the effect
    // Textures are owned by the asset bundle, never by a node — destroy the display objects only.
    this.view.destroy({ children: true, texture: false, textureSource: false });
  }
}
