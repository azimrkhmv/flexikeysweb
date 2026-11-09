// Seeded randomness for the skill games (games spec 8 Nov 2026, §1): the same seed always builds the same rounds, so
// each day brings new rounds (seed = child id + date + activity id) and tests can use a fixed seed.

export type Rng = () => number;

/** FNV-1a: a string to a 32-bit number. */
export const hash = (s: string) => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;

/** mulberry32: a small, fast generator of numbers in [0, 1). */
export function rngOf(seed: string | number): Rng {
  let a = typeof seed === "number" ? seed >>> 0 : hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The day's seed of one game for one child (games spec §1). */
export const daySeed = (childId: string, date: string, activityId: string) => `${childId}|${date}|${activityId}`;

/** A whole number from lo to hi, both included. */
export const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
export const one = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
export function shuffled<T>(rng: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** `n` different picks from `xs`, never one of `not`. */
export const sample = <T>(rng: Rng, xs: readonly T[], n: number, not: readonly T[] = []): T[] => shuffled(rng, xs.filter((x) => !not.includes(x))).slice(0, n);
/** A shuffle that never leaves every element where it was (a puzzle that is not already solved). */
export function deranged<T>(rng: Rng, xs: readonly T[]): T[] {
  if (xs.length < 2) return [...xs];
  for (;;) {
    const s = shuffled(rng, xs);
    if (s.some((x, i) => x !== xs[i])) return s;
  }
}
