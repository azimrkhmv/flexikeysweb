import { CHIRAL, EXTRA_SHAPES, glyph, glyphId, GLYPH_COLORS, GLYPH_SHAPES, parseGlyph, TURNABLE, type Glyph, type GlyphColor, type GlyphShape } from "./glyph";
import { CATEGORIES, lookOf, numId, numOf } from "./pools";
import { int, one, sample, shuffled } from "./rng";
import type { Generator } from "./index";

// Round generators of the new Reasoning games (games spec 8 Nov 2026, §6.4): next_pattern, balance, pipes,
// logic_houses, shadow_match. `pipes` and `logic_houses` prove their puzzles with a small solver.

const BASIC: GlyphShape[] = ["circle", "square", "triangle", "star", "heart"];
const g = (shape: GlyphShape, color: GlyphColor, more: Partial<Glyph> = {}) => glyphId(glyph({ shape, color, ...more }));

// ---------------------------------------------------------------- next_pattern
export interface NextPatternSettings {
  /** ab · aab · abc: a repeating row · grow: small, middle, big again and again · turn: a shape turning a quarter
   *  each time · grid: a square of shapes, the last one missing. */
  mode: "ab" | "aab" | "abc" | "grow" | "turn" | "grid";
  /** What changes in a row: the colour, the shape or both. */
  by?: "color" | "shape" | "both";
  /** grid: 2 or 3 rows and columns; 1 rule (a shape per row) or 2 (a shape per row and a colour per column). */
  size?: 2 | 3;
  rules?: 1 | 2;
  options: number;
}
export interface NextPatternRound {
  mode: NextPatternSettings["mode"];
  /** A row: what is shown before the gap. A grid: every cell, the last one being the answer (hidden on screen). */
  seq: string[];
  size?: number;
  answer: string;
  options: string[];
}
/** What finishes the pattern, worked out from what the child sees (the shortest repeat, the turn, the grid's rules). */
export function predictPattern(r: Pick<NextPatternRound, "mode" | "seq" | "size">): string | undefined {
  const s = r.seq;
  if (r.mode === "grid") {
    const n = r.size!;
    const rowFirst = parseGlyph(s[(n - 1) * n]);
    const colTop = parseGlyph(s[n - 1]);
    // The shape comes from the row; the colour from the column when the colours change along a row.
    const colorsChange = parseGlyph(s[0]).color !== parseGlyph(s[1]).color;
    return glyphId({ ...rowFirst, color: colorsChange ? colTop.color : rowFirst.color, tag: undefined });
  }
  if (r.mode === "turn") {
    const a = parseGlyph(s[s.length - 2]);
    const b = parseGlyph(s[s.length - 1]);
    return glyphId({ ...b, rot: b.rot + (b.rot - a.rot), tag: undefined });
  }
  for (let p = 1; p * 2 <= s.length; p++) if (s.every((x, i) => i < p || lookOf(x) === lookOf(s[i - p]))) return s[s.length - p];
  return undefined;
}
/** Wrong options that differ from the answer in one feature (another colour, shape, size or turn). */
function oneOff(rng: () => number, answer: string, n: number, prefer: string[] = []): string[] {
  const a = parseGlyph(answer);
  const out: string[] = [];
  const add = (x: string) => {
    if (lookOf(x) !== lookOf(answer) && !out.some((o) => lookOf(o) === lookOf(x))) out.push(x);
  };
  for (const x of shuffled(rng, prefer)) if (out.length < n) add(x);
  for (let k = 0; out.length < n && k < 200; k++) {
    const f = one(rng, ["color", "shape", "size", ...(TURNABLE.includes(a.shape) ? ["rot"] : [])] as const);
    if (f === "color") add(glyphId({ ...a, color: one(rng, GLYPH_COLORS) }));
    else if (f === "shape") add(glyphId({ ...a, shape: one(rng, BASIC) }));
    else if (f === "size") add(glyphId({ ...a, size: one(rng, [0, 1, 2] as const) }));
    else add(glyphId({ ...a, rot: a.rot + one(rng, [90, 180, 270]) }));
  }
  return out;
}
export const nextPattern: Generator<NextPatternSettings, NextPatternRound> = {
  rounds: 4,
  make({ mode, by = "color", size: n = 3, rules = 2, options }, rng) {
    if (mode === "grid") {
      const shapes = sample(rng, BASIC, n);
      const colors = sample(rng, GLYPH_COLORS, n);
      const one1 = one(rng, GLYPH_COLORS);
      const cells = shapes.flatMap((sh) => colors.map((c) => g(sh, rules === 2 ? c : one1)));
      const answer = cells[cells.length - 1];
      // Near misses first: the other rows' shapes and the other columns' colours, each with the rest right.
      const prefer = [...shapes.slice(0, -1).map((sh) => glyphId({ ...parseGlyph(answer), shape: sh })), ...(rules === 2 ? colors.slice(0, -1).map((c) => glyphId({ ...parseGlyph(answer), color: c })) : [])];
      return { mode, seq: cells, size: n, answer, options: shuffled(rng, [answer, ...oneOff(rng, answer, options - 1, prefer)]) };
    }
    let unit: string[];
    if (mode === "grow") {
      const sh = one(rng, BASIC);
      const c = one(rng, GLYPH_COLORS);
      unit = ([0, 1, 2] as const).map((size) => g(sh, c, { size }));
    } else if (mode === "turn") {
      const sh = one(rng, TURNABLE);
      const c = one(rng, GLYPH_COLORS);
      const start = int(rng, 0, 3) * 90;
      const len = int(rng, 4, 5);
      const seq = Array.from({ length: len }, (_, k) => g(sh, c, { rot: start + k * 90 }));
      const answer = g(sh, c, { rot: start + len * 90 });
      return { mode, seq, answer, options: shuffled(rng, [answer, ...oneOff(rng, answer, options - 1, [90, 180].map((d) => g(sh, c, { rot: start + len * 90 + d })))]) };
    } else {
      const k = mode === "ab" ? 2 : 3;
      const shapes = sample(rng, BASIC, k);
      const colors = sample(rng, GLYPH_COLORS, k);
      const sh = one(rng, BASIC);
      const c = one(rng, GLYPH_COLORS);
      const items = Array.from({ length: k }, (_, i) => (by === "color" ? g(sh, colors[i]) : by === "shape" ? g(shapes[i], c) : g(shapes[i], colors[i])));
      unit = mode === "aab" ? [items[0], items[0], items[1]] : items;
    }
    const len = unit.length * 2 + int(rng, 0, unit.length - 1);
    const seq = Array.from({ length: len }, (_, i) => unit[i % unit.length]);
    const answer = unit[len % unit.length];
    return { mode, seq, answer, options: shuffled(rng, [answer, ...oneOff(rng, answer, options - 1, unit)]) };
  },
  key: (r) => `${r.mode}|${r.seq.map(lookOf).join(",")}`,
  answers: (r) => {
    const want = predictPattern(r);
    return [want ? r.options.filter((o) => lookOf(o) === lookOf(want)).length : 0];
  },
};

// ---------------------------------------------------------------- balance
export interface Scale {
  left: string[];
  right: string[];
  /** -1 the left side is down (heavier) · 0 level · 1 the right side is down. */
  tilt: -1 | 0 | 1;
}
export interface BalanceSettings {
  /** most: which thing is heaviest (or lightest) · count: how many circles weigh as much as the asked things. */
  mode: "most" | "count";
  items?: number;
  ask?: "heavy" | "light";
  /** The scales in a jumbled order with the heavy side on either hand. */
  shuffle?: boolean;
  /** count: 1 one scale (2 squares = ? circles) · 2 two scales one after the other · 3 a scale with two kinds. */
  level?: 1 | 2 | 3;
  options: number;
}
export interface BalanceRound {
  scales: Scale[];
  ask: "heavy" | "light" | "count";
  /** count: the things on the asked side and the one counted with. */
  asked?: string[];
  unit?: string;
  answer: string;
  options: string[];
}
const WEIGHTS = [...CATEGORIES.fruits, ...CATEGORIES.toys];
export const SQUARE = g("square", "blue");
export const TRIANGLE = g("triangle", "green");
export const CIRCLE = g("circle", "yellow");
/** The weight of each thing in circles, from the level scales (each solved when it has one unknown kind). */
export function solveScales(scales: Scale[], unit: string): Map<string, number> | undefined {
  const w = new Map([[unit, 1]]);
  for (let pass = 0; pass < scales.length + 1; pass++)
    for (const s of scales) {
      if (s.tilt !== 0) continue;
      const all = [...s.left, ...s.right];
      const unknown = [...new Set(all.filter((x) => !w.has(x)))];
      if (unknown.length !== 1) continue;
      const u = unknown[0];
      const side = (xs: string[]) => xs.reduce((a, x) => a + (x === u ? 0 : w.get(x)!), 0);
      const count = (xs: string[]) => xs.filter((x) => x === u).length;
      const v = (side(s.right) - side(s.left)) / (count(s.left) - count(s.right));
      if (v > 0) w.set(u, v);
    }
  return w;
}
/** The things every other thing is lighter (or heavier) than, by the tilted scales and what follows from them. */
export function extremes(scales: Scale[], ask: "heavy" | "light"): string[] {
  const items = [...new Set(scales.flatMap((s) => [...s.left, ...s.right]))];
  const heavier = new Set(scales.filter((s) => s.tilt !== 0).map((s) => (s.tilt < 0 ? `${s.left[0]}>${s.right[0]}` : `${s.right[0]}>${s.left[0]}`)));
  for (const k of items) for (const i of items) for (const j of items) if (heavier.has(`${i}>${k}`) && heavier.has(`${k}>${j}`)) heavier.add(`${i}>${j}`);
  return items.filter((x) => items.every((y) => y === x || heavier.has(ask === "heavy" ? `${x}>${y}` : `${y}>${x}`)));
}
export const balance: Generator<BalanceSettings, BalanceRound> = {
  rounds: 3,
  make({ mode, items: n = 2, ask = "heavy", shuffle = false, level = 1, options }, rng) {
    if (mode === "count") {
      let scales: Scale[];
      let asked: string[];
      if (level === 1) {
        const k = int(rng, 2, 4);
        scales = [{ left: [SQUARE], right: Array(k).fill(CIRCLE), tilt: 0 }];
        asked = Array(int(rng, 2, 3)).fill(SQUARE);
      } else if (level === 2) {
        const [a, b] = [int(rng, 2, 3), int(rng, 2, 3)];
        scales = shuffled(rng, [
          { left: [SQUARE], right: Array(a).fill(TRIANGLE), tilt: 0 as const },
          { left: [TRIANGLE], right: Array(b).fill(CIRCLE), tilt: 0 as const },
        ]);
        asked = [SQUARE];
      } else {
        const [b, c] = [int(rng, 2, 4), int(rng, 1, 2)];
        scales = shuffled(rng, [
          { left: [SQUARE], right: [TRIANGLE, ...Array(c).fill(CIRCLE)], tilt: 0 as const },
          { left: [TRIANGLE], right: Array(b).fill(CIRCLE), tilt: 0 as const },
        ]);
        asked = [SQUARE];
      }
      const w = solveScales(scales, CIRCLE)!;
      const v = asked.reduce((s, x) => s + w.get(x)!, 0);
      const near = shuffled(rng, [v - 2, v - 1, v + 1, v + 2, v + 3].filter((x) => x > 0));
      return { scales, ask: "count", asked, unit: CIRCLE, answer: numId(v), options: [v, ...near.slice(0, options - 1)].sort((x, y) => x - y).map(numId) };
    }
    const things = sample(rng, WEIGHTS, n); // heaviest first
    let scales: Scale[] = things.slice(0, -1).map((x, i) => (shuffle && rng() < 0.5 ? { left: [things[i + 1]], right: [x], tilt: 1 } : { left: [x], right: [things[i + 1]], tilt: -1 }));
    if (shuffle) scales = shuffled(rng, scales);
    const answer = ask === "heavy" ? things[0] : things[n - 1];
    return { scales, ask, answer, options: shuffled(rng, things) };
  },
  key: (r) => `${r.ask}|${r.scales.map((s) => `${s.left.join("+")}${s.tilt}${s.right.join("+")}`).join(";")}`,
  answers: (r) => {
    if (r.ask === "count") {
      const w = solveScales(r.scales, r.unit!);
      const v = w && r.asked!.every((x) => w.has(x)) ? r.asked!.reduce((s, x) => s + w.get(x)!, 0) : NaN;
      return [r.options.filter((o) => numOf(o) === v).length];
    }
    const best = extremes(r.scales, r.ask);
    return [best.length === 1 ? r.options.filter((o) => o === best[0]).length : 0];
  },
};

// ---------------------------------------------------------------- pipes
/** Openings of a pipe piece: up 1, right 2, down 4, left 8. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
/** A quarter turn clockwise. */
export const turn = (m: number) => ((m << 1) | (m >> 3)) & 15;
export const turns = (m: number, k: number) => Array.from({ length: k }).reduce<number>((x) => turn(x), m);
const STEP: [number, number, number, number][] = [
  [N, -1, 0, S],
  [E, 0, 1, W],
  [S, 1, 0, N],
  [W, 0, -1, E],
];
export interface PipesSettings {
  cols: number;
  rows: number;
  flowers: 1 | 2;
}
export interface PipesRound {
  cols: number;
  rows: number;
  /** The tap pours into the left side of this row. */
  source: number;
  /** Each flower sits beside an edge cell, on the side `dir` (E: right edge, S: bottom edge). */
  flowers: { r: number; c: number; dir: number }[];
  /** Each piece as it lies at the start, and turned the way the made path needs. */
  start: number[];
  solution: number[];
  /** The pieces of the made path (the others are spare pieces). */
  path: boolean[];
}
/** The cells water reaches from the tap, through openings that meet. */
export function wet(r: Pick<PipesRound, "cols" | "rows" | "source">, cells: number[]): Set<number> {
  const first = r.source * r.cols;
  const seen = new Set<number>();
  if (!(cells[first] & W)) return seen;
  const todo = [first];
  seen.add(first);
  while (todo.length) {
    const i = todo.pop()!;
    const [row, col] = [Math.floor(i / r.cols), i % r.cols];
    for (const [d, dr, dc, back] of STEP) {
      const [nr, nc] = [row + dr, col + dc];
      if (!(cells[i] & d) || nr < 0 || nc < 0 || nr >= r.rows || nc >= r.cols) continue;
      const j = nr * r.cols + nc;
      if (cells[j] & back && !seen.has(j)) {
        seen.add(j);
        todo.push(j);
      }
    }
  }
  return seen;
}
/** Every flower gets water: its edge cell is wet and open towards it. */
export function watered(r: Omit<PipesRound, "start" | "solution" | "path">, cells: number[]) {
  const w = wet(r, cells);
  return r.flowers.every((f) => w.has(f.r * r.cols + f.c) && (cells[f.r * r.cols + f.c] & f.dir) !== 0);
}
/** A path from `from` to `to` through free cells (a depth-first walk in a random order). */
function walk(rng: () => number, rows: number, cols: number, from: number, to: number, used: Set<number>): number[] | undefined {
  const seen = new Set(used);
  const go = (i: number): number[] | undefined => {
    if (i === to) return [i];
    seen.add(i);
    const [row, col] = [Math.floor(i / cols), i % cols];
    for (const [, dr, dc] of shuffled(rng, STEP)) {
      const [nr, nc] = [row + dr, col + dc];
      const j = nr * cols + nc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || seen.has(j)) continue;
      const rest = go(j);
      if (rest) return [i, ...rest];
    }
    return undefined;
  };
  return go(from);
}
const dirTo = (cols: number, a: number, b: number) => (b === a - cols ? N : b === a + 1 ? E : b === a + cols ? S : W);
const opposite = (d: number) => turns(d, 2);
export const pipes: Generator<PipesSettings, PipesRound> = {
  rounds: 1,
  make({ cols, rows, flowers: nf }, rng) {
    for (;;) {
      const source = int(rng, 0, rows - 1);
      const flowerRow = int(rng, 0, rows - 1);
      const mask = Array<number>(rows * cols).fill(0);
      const p1 = walk(rng, rows, cols, source * cols, flowerRow * cols + cols - 1, new Set());
      if (!p1) continue;
      const link = (path: number[]) => path.slice(1).forEach((b, k) => ((mask[path[k]] |= dirTo(cols, path[k], b)), (mask[b] |= opposite(dirTo(cols, path[k], b)))));
      link(p1);
      mask[source * cols] |= W;
      mask[flowerRow * cols + cols - 1] |= E;
      const flowers = [{ r: flowerRow, c: cols - 1, dir: E }];
      if (nf === 2) {
        // The second flower is under the bottom row; its pipe leaves the first path at one of its pieces.
        const fc = int(rng, 0, cols - 2);
        const end = (rows - 1) * cols + fc;
        if (p1.includes(end)) continue;
        const used = new Set(p1);
        let p2: number[] | undefined;
        for (const b of shuffled(rng, p1)) {
          for (const [, dr, dc] of shuffled(rng, STEP)) {
            const [nr, nc] = [Math.floor(b / cols) + dr, (b % cols) + dc];
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || used.has(nr * cols + nc)) continue;
            const rest = walk(rng, rows, cols, nr * cols + nc, end, used);
            if (rest) {
              p2 = [b, ...rest];
              break;
            }
          }
          if (p2) break;
        }
        if (!p2) continue;
        link(p2);
        mask[end] |= S;
        flowers.push({ r: rows - 1, c: fc, dir: S });
      }
      const path = mask.map((m) => m !== 0);
      // Spare pieces: straight or corner pipes, lying any way.
      const solution = mask.map((m) => m || turns(one(rng, [N | S, N | E]), int(rng, 0, 3)));
      const onPath = path.filter(Boolean).length;
      for (let k = 0; k < 50; k++) {
        const start = solution.map((m) => turns(m, int(rng, 0, 3)));
        const wrong = start.filter((m, i) => path[i] && m !== solution[i]).length;
        const round = { cols, rows, source, flowers, start, solution, path };
        if (wrong >= Math.max(1, Math.floor(onPath / 2)) && !watered(round, start)) return round;
      }
    }
  },
  key: (r) => `${r.source}|${r.solution.join(",")}`,
  // The made path is a working answer, and the start is not one yet.
  answers: (r) => [watered(r, r.solution) && !watered(r, r.start) && r.start.every((m, i) => [0, 1, 2, 3].some((k) => turns(m, k) === r.solution[i])) ? 1 : 0],
};

// ---------------------------------------------------------------- logic_houses
export const HOUSE_ANIMALS = ["cat", "dog", "cow", "horse", "sheep", "rabbit", "frog", "bird"];
export type Clue =
  | { t: "at"; a: string; h: number }
  /** a lives somewhere left of b */
  | { t: "left"; a: string; b: string }
  /** a lives next door to b */
  | { t: "next"; a: string; b: string }
  /** b lives just right of a */
  | { t: "before"; a: string; b: string };
export interface LogicHousesSettings {
  houses: number;
  clues: number;
  /** At most this many "lives in house n" clues (the others compare two animals). */
  at: number;
}
export interface LogicHousesRound {
  /** The animals, in the order they are shown waiting. */
  animals: string[];
  clues: Clue[];
  /** The animal in each house, left to right. */
  solution: string[];
}
const holds = (c: Clue, pos: Record<string, number>) =>
  c.t === "at" ? pos[c.a] === c.h : c.t === "left" ? pos[c.a] < pos[c.b] : c.t === "next" ? Math.abs(pos[c.a] - pos[c.b]) === 1 : pos[c.b] === pos[c.a] + 1;
function orders<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => orders([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}
/** Every way to put the animals in the houses that keeps all the clues (at most 5! = 120 to try). */
export function solveHouses(animals: string[], clues: Clue[]): string[][] {
  return orders(animals).filter((o) => {
    const pos = Object.fromEntries(o.map((a, i) => [a, i]));
    return clues.every((c) => holds(c, pos));
  });
}
export const logicHouses: Generator<LogicHousesSettings, LogicHousesRound> = {
  rounds: 1,
  make({ houses: n, clues: k, at }, rng) {
    for (;;) {
      const solution = sample(rng, HOUSE_ANIMALS, n);
      const pos = Object.fromEntries(solution.map((a, i) => [a, i]));
      const pairs = solution.flatMap((a) => solution.filter((b) => b !== a).map((b) => [a, b] as const));
      const atPool: Clue[] = solution.map((a) => ({ t: "at", a, h: pos[a] }));
      const relPool: Clue[] = pairs.flatMap(([a, b]) => [
        ...(pos[a] < pos[b] ? [{ t: "left" as const, a, b }] : []),
        ...(pos[b] === pos[a] + 1 ? [{ t: "before" as const, a, b }] : []),
        ...(Math.abs(pos[a] - pos[b]) === 1 && a < b ? [{ t: "next" as const, a, b }] : []),
      ]);
      for (let tries = 0; tries < 300; tries++) {
        const nAt = Math.min(at, k, int(rng, 0, at));
        const clues = shuffled(rng, [...sample(rng, atPool, nAt), ...sample(rng, relPool, k - nAt)]);
        if (clues.length === k && solveHouses(solution, clues).length === 1) return { animals: shuffled(rng, solution), clues, solution };
      }
    }
  },
  key: (r) => r.clues.map((c) => JSON.stringify(c)).join(";"),
  // Exactly one way to fill the houses; then each question (house 1 … n−1, from the animals still waiting) has one answer.
  answers: (r) => {
    const sols = solveHouses(r.animals, r.clues);
    if (sols.length !== 1 || sols[0].join() !== r.solution.join()) return r.solution.slice(0, -1).map(() => 0);
    return r.solution.slice(0, -1).map((_, h) => r.solution.slice(h).filter((a) => a === sols[0][h]).length);
  },
};

// ---------------------------------------------------------------- shadow_match
export interface ShadowSettings {
  options: number;
  /** any: other shapes · similar: other shapes that are easy to mix up · mirror: the same shape, mirrored. */
  pool: "any" | "similar" | "mirror";
  /** none: nothing turned · same: the shadow and the shapes turned the same way · other: the right shape turned
   *  another way than its shadow. */
  turn: "none" | "same" | "other";
  /** The shadow is mirrored too (the right shape is the mirrored one; the others are not). */
  flip?: boolean;
}
export interface ShadowRound {
  shadow: string;
  answer: string;
  options: string[];
}
const ALL_SHAPES: GlyphShape[] = [...GLYPH_SHAPES, ...EXTRA_SHAPES];
/** A shape fits a shadow when a turn (never a mirror) makes them the same. */
export function fitsShadow(shadow: string, option: string) {
  const a = parseGlyph(shadow);
  const b = parseGlyph(option);
  return a.shape === b.shape && (!CHIRAL.includes(a.shape) || a.flip === b.flip);
}
export const shadowMatch: Generator<ShadowSettings, ShadowRound> = {
  rounds: 4,
  make({ options: n, pool, turn: tm, flip = false }, rng) {
    const shape = one(rng, pool === "mirror" ? CHIRAL : pool === "similar" ? [...TURNABLE, ...CHIRAL] : ALL_SHAPES);
    const rots = [0, 45, 90, 135, 180, 225, 270, 315];
    const r0 = tm === "none" ? 0 : one(rng, rots);
    const shadow = g(shape, "blue", { color: "shadow", rot: r0, flip });
    const rightRot = tm === "other" ? one(rng, rots.filter((x) => x !== r0)) : r0;
    // Every option its own colour, so no two of them sound the same when read out.
    const colors = sample(rng, GLYPH_COLORS, n);
    const answer = g(shape, colors[0], { rot: rightRot, flip });
    const rot = () => (tm === "none" ? 0 : tm === "same" ? r0 : one(rng, rots));
    const wrong: string[] = [];
    for (let k = 0; wrong.length < n - 1 && k < 300; k++) {
      const x =
        pool === "mirror"
          ? g(shape, colors[wrong.length + 1], { rot: one(rng, rots), flip: !flip })
          : g(one(rng, (pool === "similar" ? [...TURNABLE, ...CHIRAL] : ALL_SHAPES).filter((s) => s !== shape)), colors[wrong.length + 1], { rot: rot() });
      if (!wrong.some((w) => parseGlyph(w).shape === parseGlyph(x).shape && parseGlyph(w).rot === parseGlyph(x).rot)) wrong.push(x);
    }
    return { shadow, answer, options: shuffled(rng, [answer, ...wrong]) };
  },
  key: (r) => `${lookOf(r.shadow)}|${r.options.map((o) => parseGlyph(o).shape).sort().join(",")}`,
  answers: (r) => [r.options.filter((o) => fitsShadow(r.shadow, o)).length],
};
