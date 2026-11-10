import { glyph, glyphId, GLYPH_COLORS, GLYPH_SHAPES, TURNABLE, type GlyphShape } from "./glyph";
import { categoryOf, copyId, lookOf, PICTURES } from "./pools";
import { int, one, sample } from "./rng";
import type { Generator } from "./index";

// Round generators of the new Attention games (games spec 8 Nov 2026, §6.1): odd_one_out, track_fish, which_way.

const BASIC: GlyphShape[] = ["circle", "square", "triangle", "star", "heart", "rectangle"];

// ---------------------------------------------------------------- odd_one_out
export interface OddOneOutSettings {
  options: number;
  /** items: very different pictures · similar: a picture of the same group · shapes: same colour, another shape ·
   *  colors: same shape, another colour · turn: the odd one turned · fine: a small turn (15–30°) or a shade. */
  mode: "items" | "similar" | "shapes" | "colors" | "turn" | "fine";
}
export interface OddOneOutRound {
  odd: string;
  /** Copies of one item ("apple~3") and the odd one, so equal pictures are still different options. */
  options: string[];
}
export const oddOneOut: Generator<OddOneOutSettings, OddOneOutRound> = {
  rounds: 4,
  make({ options: n, mode }, rng) {
    let same: string;
    let odd: string;
    if (mode === "items" || mode === "similar") {
      same = one(rng, PICTURES);
      odd = one(rng, PICTURES.filter((x) => x !== same && (categoryOf(x) === categoryOf(same)) === (mode === "similar")));
    } else if (mode === "shapes") {
      const color = one(rng, GLYPH_COLORS);
      const [a, b] = sample(rng, GLYPH_SHAPES, 2);
      [same, odd] = [glyphId(glyph({ shape: a, color })), glyphId(glyph({ shape: b, color }))];
    } else if (mode === "colors") {
      const shape = one(rng, BASIC);
      const [a, b] = sample(rng, GLYPH_COLORS, 2);
      [same, odd] = [glyphId(glyph({ shape, color: a })), glyphId(glyph({ shape, color: b }))];
    } else {
      const shape = one(rng, TURNABLE);
      const color = one(rng, GLYPH_COLORS);
      const rot = int(rng, 0, 11) * 30;
      const shade = int(rng, 0, 2) as 0 | 1 | 2;
      same = glyphId(glyph({ shape, color, rot, shade }));
      if (mode === "turn") odd = glyphId(glyph({ shape, color, shade, rot: rot + one(rng, [60, 90, 120, 180, 240, 270, 300]) }));
      else if (rng() < 0.5) odd = glyphId(glyph({ shape, color, shade, rot: rot + one(rng, [-30, -15, 15, 30]) }));
      else odd = glyphId(glyph({ shape, color, rot, shade: one(rng, ([0, 1, 2] as const).filter((s) => s !== shade)) }));
    }
    const at = int(rng, 0, n - 1);
    const options = Array.from({ length: n }, (_, k) => copyId(k === at ? odd : same, k));
    return { odd: options[at], options };
  },
  key: (r) => `${lookOf(r.odd)}|${lookOf(r.options.find((o) => o !== r.odd)!)}|${r.options.indexOf(r.odd)}`,
  // The options whose look no other option shares: exactly the odd one.
  answers: (r) => [r.options.filter((o) => r.options.filter((x) => lookOf(x) === lookOf(o)).length === 1 && o === r.odd).length * (new Set(r.options.map(lookOf)).size === 2 ? 1 : 0)],
};

// ---------------------------------------------------------------- track_fish
export interface TrackFishSettings {
  fish: number;
  /** How many fish glow at the start. */
  glow: number;
  /** 1 slow … 4 fast: the time of one swim between two places. */
  speed: 1 | 2 | 3 | 4;
  /** Places each fish swims through before it stops. */
  moves: number;
}
export interface TrackFishRound {
  glow: number[];
  /** Each fish's places in % of the tank (x, y): the first is where it starts, the last where it stops. */
  paths: [number, number][][];
  speed: 1 | 2 | 3 | 4;
}
/** Milliseconds of one swim at each speed. */
export const FISH_MS = { 1: 1500, 2: 1100, 3: 800, 4: 600 } as const;
/** The tank's grid for n fish (4:3): every fish starts and stops in a cell of its own, so none covers another. */
export const fishGrid = (n: number) => (n <= 4 ? [2, 2] : n <= 6 ? [3, 2] : n <= 9 ? [3, 3] : [4, 3]);
const cellCentre = (cell: number, cols: number, rows: number): [number, number] => [((cell % cols) + 0.5) * (100 / cols), (Math.floor(cell / cols) + 0.5) * (100 / rows)];

export const trackFish: Generator<TrackFishSettings, TrackFishRound> = {
  rounds: 3,
  make({ fish: n, glow: k, speed, moves }, rng) {
    const [cols, rows] = fishGrid(n);
    const cells = Array.from({ length: cols * rows }, (_, c) => c);
    const start = sample(rng, cells, n);
    const stop = sample(rng, cells, n);
    const paths = start.map((s, f) => [
      cellCentre(s, cols, rows),
      ...Array.from({ length: moves - 1 }, (): [number, number] => [int(rng, 10, 90), int(rng, 12, 88)]),
      cellCentre(stop[f], cols, rows),
    ]);
    return { glow: sample(rng, Array.from({ length: n }, (_, f) => f), k).sort((a, b) => a - b), paths, speed };
  },
  key: (r) => `${r.glow.join(",")}|${r.paths.map((p) => `${p[0]}>${p[p.length - 1]}`).join(";")}`,
  // One right set to pick: the glowing fish, each one where no other fish stops.
  answers: (r) => {
    const ends = r.paths.map((p) => String(p[p.length - 1]));
    return [new Set(r.glow).size === r.glow.length && r.glow.every((f) => f < r.paths.length) && new Set(ends).size === ends.length ? 1 : 0];
  },
};

// ---------------------------------------------------------------- which_way
export type Dir = "up" | "right" | "down" | "left";
export const DIRS: Dir[] = ["up", "right", "down", "left"];
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
export const dirRot = (d: Dir) => DIRS.indexOf(d) * 90;
/** An option: a green arrow pointing that way. */
export const dirId = (d: Dir) => glyphId(glyph({ shape: "arrow", color: "green", rot: dirRot(d) }));
export const dirOf = (id: string) => DIRS[Number(id.split(":")[3]) / 90];

export interface WhichWaySettings {
  /** 2: left and right · 4: all four ways. */
  dirs: 2 | 4;
  /** Arrows on each side of the middle one. */
  flank: 0 | 1 | 2 | 3;
  /** same: they point the middle arrow's way · mixed: either way · against: another way. */
  mode?: "same" | "mixed" | "against";
  /** Share of rounds with a blue middle arrow: then the answer is the opposite way. */
  blue?: number;
}
export interface WhichWayRound {
  dir: Dir;
  flankDir: Dir | null;
  flank: number;
  blue: boolean;
  answer: string;
  options: string[];
}
export const whichWay: Generator<WhichWaySettings, WhichWayRound> = {
  rounds: 4,
  make({ dirs, flank, mode = "same", blue = 0 }, rng) {
    const ways: Dir[] = dirs === 2 ? ["left", "right"] : DIRS;
    const dir = one(rng, ways);
    const flankDir = !flank ? null : mode === "same" ? dir : mode === "against" ? one(rng, ways.filter((w) => w !== dir)) : one(rng, ways);
    const isBlue = rng() < blue;
    return { dir, flankDir, flank, blue: isBlue, answer: dirId(isBlue ? OPPOSITE[dir] : dir), options: ways.map(dirId) };
  },
  key: (r) => `${r.dir}|${r.flankDir}|${r.blue}`,
  answers: (r) => [new Set(r.options).size === r.options.length ? r.options.filter((o) => o === r.answer).length : 0],
};
