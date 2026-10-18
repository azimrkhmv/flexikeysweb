// Play check, stage 1 — hands and touch (spec §7). No thinking content, only how the child uses the screen; it
// comes first because a child who misses a small button may understand perfectly. Pure rules, used by the screen
// (features/play/PlayCheck.tsx) and tested on their own. Nothing here is ever shown to the parent as a score.

export type InputMode = "touch" | "dwell" | "switch" | "keyboard";

/** The child's five access settings. Every game reads them. */
export interface AccessSettings {
  inputMode: InputMode;
  /** The smallest button that works, never below 12 mm. */
  minTargetMm: number;
  /** How long a hold chooses, 500–3000 ms. */
  dwellMs: number;
  /** Ignore a second touch within 300 ms. */
  repeatLock: boolean;
  /** The child lifts the finger cleanly after holding. */
  releaseOk: boolean;
}

/** One touch on the screen during the check: did it land on the target, and when (ms). */
export interface Touch {
  hit: boolean;
  at: number;
}

export const REPEAT_MS = 300;
export const TAPS = 5;
/** Button sizes tried, largest first (mm). */
export const SIZES_MM = [40, 32, 26, 20, 16, 12] as const;
export const HOLDS = 3;

/** A touch that comes within 300 ms of the one before is an accidental repeat. */
const repeats = (touches: Touch[]) => touches.filter((t, i) => i > 0 && t.at - touches[i - 1].at < REPEAT_MS).length;

/**
 * Normal touch works unless 3 of 5 taps miss or repeat; then hold-to-choose is offered, and if holding goes the same
 * way, switch scanning. `touches` are all the touches of that try (five choices asked for).
 */
export function struggles(touches: Touch[]): boolean {
  const misses = touches.filter((t) => !t.hit).length;
  return misses + repeats(touches) >= 3;
}

/** The button ladder: smaller after each hit; two misses in a row at a size step back one size, and that is it. */
export function sizeStep(state: { i: number; missed: number }, hit: boolean): { i: number; missed: number; done?: number } {
  if (hit) return state.i === SIZES_MM.length - 1 ? { ...state, done: SIZES_MM[state.i] } : { i: state.i + 1, missed: 0 };
  if (state.missed + 1 < 2) return { ...state, missed: state.missed + 1 };
  return { ...state, missed: 2, done: SIZES_MM[Math.max(0, state.i - 1)] };
}

/**
 * The hold time: a little under the child's usual comfortable hold, so a choice never needs more than they can
 * give. ponytail: 80% of the median hold; tune with the physiotherapist once real children have done the check.
 */
export function holdTime(holdsMs: number[]): number {
  const sorted = [...holdsMs].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 1000;
  return Math.min(3000, Math.max(500, Math.round((median * 0.8) / 50) * 50));
}

/** Repeat lock on when accidental repeats happened more than once during the whole check. */
export const repeatLock = (touches: Touch[]) => repeats(touches) >= 2;

/** Clean release: after most holds, no extra touch within 300 ms of letting go. */
export const releaseOk = (extraTouchAfter: boolean[]) => extraTouchAfter.filter(Boolean).length * 2 < Math.max(1, extraTouchAfter.length);

/** CSS pixels for a size in mm (a CSS inch is 96 px). */
export const mmToPx = (mm: number) => Math.round((mm * 96) / 25.4);
