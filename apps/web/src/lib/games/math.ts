import { CATEGORIES } from "./pools";
import { int, one, sample, shuffled, type Rng } from "./rng";
import type { Generator } from "./index";

// Round generators of the new Math games (games spec 8 Nov 2026, §6.5): more_less, number_line, bazaar,
// missing_number.

// ---------------------------------------------------------------- more_less
export interface MoreLessSettings {
  /** Dots in a group, from min to max. */
  min: number;
  max: number;
  /** How many more dots the bigger group has, from diff[0] to diff[1]. */
  diff: [number, number];
  /** Dots of mixed sizes: the smaller group gets the bigger dots, so the child must not judge by the ink. */
  mixed?: boolean;
  /** Seconds the dots are shown before clouds cover them (no countdown is shown); 0 = shown until the answer. */
  cover?: number;
  /** Ask which group has more, which has less, or either. */
  ask: "more" | "less" | "both";
}
/** A dot: its place in the card (0–1) and its size (0 small, 1 middle, 2 big). */
export interface Dot {
  x: number;
  y: number;
  s: 0 | 1 | 2;
}
export interface MoreLessRound {
  groups: [Dot[], Dot[]];
  ask: "more" | "less";
  cover: number;
}
/** n dots on a jittered 5×5 grid, never two in one cell (so they never overlap). */
function scatter(rng: Rng, n: number, size: () => Dot["s"]): Dot[] {
  return sample(
    rng,
    Array.from({ length: 25 }, (_, k) => k),
    n,
  ).map((c) => ({ x: ((c % 5) + 0.5 + (rng() - 0.5) * 0.3) / 5, y: (Math.floor(c / 5) + 0.5 + (rng() - 0.5) * 0.3) / 5, s: size() }));
}
export const moreLess: Generator<MoreLessSettings, MoreLessRound> = {
  rounds: 4,
  make({ min, max, diff, mixed, cover = 0, ask }, rng) {
    const d = int(rng, diff[0], diff[1]);
    const few = int(rng, min, max - d);
    const many = few + d;
    // Mixed: the group with fewer dots has the bigger ones.
    const fewDots = scatter(rng, few, () => (mixed ? (one(rng, [1, 2, 2]) as Dot["s"]) : 1));
    const manyDots = scatter(rng, many, () => (mixed ? (one(rng, [0, 0, 1]) as Dot["s"]) : 1));
    const groups: [Dot[], Dot[]] = rng() < 0.5 ? [fewDots, manyDots] : [manyDots, fewDots];
    return { groups, ask: ask === "both" ? one(rng, ["more", "less"] as const) : ask, cover };
  },
  key: (r) => `${r.groups[0].length}|${r.groups[1].length}|${r.ask}`,
  // One group has more dots than the other.
  answers: (r) => [r.groups[0].length !== r.groups[1].length ? 1 : 0],
};
/** The option id of the right group ("g0" or "g1"). */
export const moreLessAnswer = (r: MoreLessRound) => {
  const [a, b] = r.groups.map((g) => g.length);
  return (r.ask === "more") === a > b ? "g0" : "g1";
};

// ---------------------------------------------------------------- number_line
export interface NumberLineSettings {
  /** The line runs from 0 to max (in quarters when frac is 4). */
  max: number;
  /** A mark every `tick`. */
  tick: number;
  /** A number written under every `labels`-th value (0: only the two ends). */
  labels: number;
  /** Marked places to choose from. */
  options: number;
  /** 4: the values are quarters (0, ¼, ½, ¾, 1, 1¼ …). */
  frac?: 4;
}
export interface NumberLineRound {
  max: number;
  tick: number;
  labels: number[];
  target: number;
  /** The marked places offered, in order along the line. */
  options: number[];
  frac?: 4;
}
const FRACTIONS = ["", "¼", "½", "¾"];
/** How a value is written: 7, 250, or 1¾ for quarters. */
export const lineText = (v: number, frac?: 4) => (frac ? `${Math.floor(v / 4) || (v % 4 ? "" : 0)}${FRACTIONS[v % 4]}` : `${v}`);
/** Marks offered are at least this many ticks apart, so their buttons never overlap on a phone. */
export const lineGap = (max: number, tick: number) => Math.max(1, Math.ceil(max / tick / 5));
export const numberLine: Generator<NumberLineSettings, NumberLineRound> = {
  rounds: 4,
  make({ max, tick, labels: every, options: n, frac }, rng) {
    const marks = Array.from({ length: max / tick + 1 }, (_, k) => k * tick);
    const labels = marks.filter((v) => v === 0 || v === max || (every > 0 && v % every === 0));
    const gap = lineGap(max, tick) * tick;
    for (;;) {
      const chosen: number[] = [];
      for (const v of shuffled(rng, marks)) if (chosen.length < n && chosen.every((c) => Math.abs(c - v) >= gap)) chosen.push(v);
      const free = chosen.filter((v) => !labels.includes(v));
      if (chosen.length === n && free.length) return { max, tick, labels, target: one(rng, free), options: chosen.sort((a, b) => a - b), frac };
    }
  },
  key: (r) => `${r.target}|${r.options.join(",")}`,
  // The target is one of the marked places offered, each a different mark on the line.
  answers: (r) => [new Set(r.options).size === r.options.length && r.options.every((v) => v % r.tick === 0 && v >= 0 && v <= r.max) ? r.options.filter((v) => v === r.target).length : 0],
};

// ---------------------------------------------------------------- bazaar
/** So'm notes and the 500 so'm coin (simple coloured cards, never copies of real notes). */
export const NOTES = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000] as const;
export interface BazaarSettings {
  /** note: the price is one note, pick it · pay: pick the notes that make the price · change: paid with a big note,
   *  pick the change. */
  mode: "note" | "pay" | "change";
  /** The biggest note used. */
  top: number;
  /** note, change: amounts to choose from. */
  options?: number;
  /** pay: notes that make the price, and notes in the wallet. */
  notes?: number;
  wallet?: number;
  /** change: the note paid with. */
  paid?: number;
  /** change: prices to 500 so'm (otherwise to 1 000). */
  half?: boolean;
}
export interface BazaarRound {
  mode: BazaarSettings["mode"];
  /** The thing bought (a picture). */
  item: string;
  price: number;
  /** note: the notes offered · pay: the wallet (one of each note, smallest first) · change: the amounts offered. */
  options: number[];
  paid?: number;
}
const GOODS = [...CATEGORIES.fruits, ...CATEGORIES.vegetables, ...CATEGORIES.toys, ...CATEGORIES.clothes];
/** Each note is worth more than all smaller notes together, so a wallet with one of each pays a price only one way. */
export function payWays(wallet: number[], price: number): number {
  let ways = 0;
  for (let m = 0; m < 1 << wallet.length; m++) if (wallet.reduce((s, v, k) => s + (m & (1 << k) ? v : 0), 0) === price) ways++;
  return ways;
}
/** The notes to pay a price with from a wallet (biggest first). */
export const payWith = (wallet: number[], price: number) => {
  const out: number[] = [];
  for (const v of [...wallet].sort((a, b) => b - a)) if (v <= price - out.reduce((s, x) => s + x, 0)) out.push(v);
  return out;
};
export const bazaar: Generator<BazaarSettings, BazaarRound> = {
  rounds: 4,
  make({ mode, top, options: n = 3, notes = 2, wallet: w = 4, paid = 10000, half }, rng) {
    const item = one(rng, GOODS);
    const notesUpTo = NOTES.filter((v) => v <= top);
    if (mode === "note") {
      const options = sample(rng, notesUpTo.filter((v) => v >= 1000), n).sort((a, b) => a - b);
      return { mode, item, price: one(rng, options), options };
    }
    if (mode === "pay") {
      const wallet = sample(rng, notesUpTo, w).sort((a, b) => a - b);
      return { mode, item, price: sample(rng, wallet, notes).reduce((s, v) => s + v, 0), options: wallet };
    }
    const unit = half ? 500 : 1000;
    const price = unit * int(rng, Math.ceil((paid * 0.2) / unit), paid / unit - 1);
    const change = paid - price;
    // The usual slips: 500 or 1 000 off, or a whole note off.
    const near = [change - 1000, change + 1000, change - unit, change + unit, change + 10000, change - 10000, change + 5000, change - 5000, change + 2000, change - 2000, change + 3000].filter((v) => v > 0 && v < paid && v !== change);
    const options = [change, ...sample(rng, [...new Set(near)], n - 1)].sort((a, b) => a - b);
    return { mode, item, price, options, paid };
  },
  key: (r) => `${r.mode}|${r.price}|${r.options.join(",")}`,
  answers: (r) => {
    if (new Set(r.options).size !== r.options.length) return [0];
    if (r.mode === "note") return [r.options.filter((v) => v === r.price).length];
    if (r.mode === "pay") return [payWays(r.options, r.price)];
    return [r.options.filter((v) => v === r.paid! - r.price).length];
  },
};

// ---------------------------------------------------------------- missing_number
export interface MissingNumberSettings {
  /** add: a + ? = c · sub: a − ? = c · addsub: either · mul: a × ? = c · muldiv: a × ? = c or c ÷ ? = a ·
   *  two: a + b − ? = c · muladd: a × ? + b = c · mulsub: a × ? − b = c. */
  form: "add" | "sub" | "addsub" | "mul" | "muldiv" | "two" | "muladd" | "mulsub";
  /** The biggest number in the sum. */
  max: number;
  options: number;
  /** Pictures under the numbers (small sums only). */
  pics?: boolean;
}
export type Part = number | "?" | "+" | "−" | "×" | "÷" | "=";
export interface MissingNumberRound {
  parts: Part[];
  answer: number;
  options: number[];
  pics: boolean;
}
/** Does the sum hold with x in the gap? (× and ÷ before + and −.) */
export function holds(parts: Part[], x: number): boolean {
  const eq = parts.indexOf("=");
  const value = (ps: Part[]) => {
    let sum = 0;
    let sign = 1;
    let term: number | null = null;
    let op: Part = "×";
    for (const p of ps.map((q) => (q === "?" ? x : q))) {
      if (typeof p === "number") term = term === null ? p : op === "×" ? term * p : term / p;
      else if (p === "×" || p === "÷") op = p;
      else {
        sum += sign * term!;
        sign = p === "+" ? 1 : -1;
        term = null;
      }
    }
    return sum + sign * term!;
  };
  return Math.abs(value(parts.slice(0, eq)) - value(parts.slice(eq + 1))) < 1e-9;
}
export const missingNumber: Generator<MissingNumberSettings, MissingNumberRound> = {
  rounds: 4,
  make({ form, max, options: n, pics = false }, rng) {
    const f = form === "addsub" ? one(rng, ["add", "sub"] as const) : form === "muldiv" ? one(rng, ["mul", "div"] as const) : form;
    let parts: Part[];
    let x: number;
    if (f === "add") {
      const c = int(rng, 2, max);
      x = int(rng, 1, c - 1);
      parts = rng() < 0.5 ? [c - x, "+", "?", "=", c] : ["?", "+", c - x, "=", c];
    } else if (f === "sub") {
      const a = int(rng, 2, max);
      x = int(rng, 1, a - 1);
      parts = [a, "−", "?", "=", a - x];
    } else if (f === "mul") {
      const a = int(rng, 2, max);
      x = int(rng, 2, 10);
      parts = [a, "×", "?", "=", a * x];
    } else if (f === "div") {
      const a = int(rng, 2, max);
      x = int(rng, 2, 10);
      parts = [a * x, "÷", "?", "=", a];
    } else if (f === "two") {
      const a = int(rng, 5, max);
      const b = int(rng, 2, max - a > 2 ? max - a : 2);
      x = int(rng, 1, a + b - 1);
      parts = [a, "+", b, "−", "?", "=", a + b - x];
    } else {
      const a = int(rng, 3, max);
      x = int(rng, 2, 9);
      const b = int(rng, 1, Math.min(9, a * x - 1));
      parts = f === "muladd" ? [a, "×", "?", "+", b, "=", a * x + b] : [a, "×", "?", "−", b, "=", a * x - b];
    }
    const near = [x - 2, x - 1, x + 1, x + 2, x + 3, x - 3].filter((v) => v >= 0);
    return { parts, answer: x, options: [x, ...sample(rng, near, n - 1)].sort((a, b) => a - b), pics };
  },
  key: (r) => r.parts.join(" "),
  // Worked out by trying every option in the sum.
  answers: (r) => [new Set(r.options).size === r.options.length ? r.options.filter((o) => holds(r.parts, o)).length : 0],
};
