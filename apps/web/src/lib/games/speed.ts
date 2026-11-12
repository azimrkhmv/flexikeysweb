import { glyph, glyphId, GLYPH_COLORS, looks, parseGlyph, TURNABLE, type GlyphColor, type GlyphShape } from "./glyph";
import { CATEGORIES, categoryOf, type Category } from "./pools";
import { int, one, sample, shuffled } from "./rng";
import type { Generator } from "./index";

// Round generators of the Speed games (games spec 8 Nov 2026, §7.3): quick_snap, tap_star, fast_sort. One round is a
// stream of items; the time each item waits (the step's window, lib/skill.ts `speedWindow`) is the player's part.

// ---------------------------------------------------------------- quick_snap
export interface QuickSnapSettings {
  /** Cards in the stream; every card after the first asks "the same as the one before?". */
  cards: number;
  /** Cards drawn from this many looks. */
  pool: number;
  /** far: shape and colour differ · shape: same colour, other shapes · color: same shape, other colours ·
   *  near: same colour, shapes that look alike · shade: one shape and colour, lighter or darker · turn: one shape, turned. */
  look: "far" | "shape" | "color" | "near" | "shade" | "turn";
}
export interface QuickSnapRound {
  seq: string[];
}
const FAR: [GlyphShape, GlyphColor][] = [["circle", "red"], ["star", "blue"], ["square", "yellow"], ["heart", "green"], ["triangle", "purple"]];
const BASIC: GlyphShape[] = ["circle", "square", "triangle", "star", "heart", "rectangle"];
/** Shapes that look alike (Summit: "similar shapes"). */
const NEAR: GlyphShape[][] = [["square", "rectangle", "house", "flag"], ["circle", "drop", "heart", "moon"], ["triangle", "arrow", "star", "corner"]];

function snapPool({ pool: n, look }: QuickSnapSettings, rng: () => number): string[] {
  const color = one(rng, GLYPH_COLORS);
  if (look === "far") return sample(rng, FAR, n).map(([shape, c]) => glyphId(glyph({ shape, color: c })));
  if (look === "shape") return sample(rng, BASIC, n).map((shape) => glyphId(glyph({ shape, color })));
  if (look === "color") {
    const shape = one(rng, BASIC);
    return sample(rng, GLYPH_COLORS, n).map((c) => glyphId(glyph({ shape, color: c })));
  }
  if (look === "near") return sample(rng, one(rng, NEAR), n).map((shape) => glyphId(glyph({ shape, color })));
  const shape = one(rng, TURNABLE);
  if (look === "shade") return sample(rng, [0, 1, 2] as const, n).map((shade) => glyphId(glyph({ shape, color, shade })));
  return sample(rng, [0, 90, 180, 270], n).map((rot) => glyphId(glyph({ shape, color, rot })));
}

export const quickSnap: Generator<QuickSnapSettings, QuickSnapRound> = {
  rounds: 1,
  make(s, rng) {
    const pool = snapPool(s, rng);
    const seq = [one(rng, pool)];
    // About half the cards are the same as the one before.
    while (seq.length < s.cards) seq.push(rng() < 0.5 ? seq[seq.length - 1] : one(rng, pool.filter((x) => x !== seq[seq.length - 1])));
    return { seq };
  },
  key: (r) => r.seq.join(","),
  // Each question is yes or no: two different cards of a round never look the same.
  answers: (r) => r.seq.slice(1).map(() => (new Set(r.seq.map(looks)).size === new Set(r.seq).size ? 1 : 0)),
};

/** The right answer to card k (k ≥ 1): is it the same as the card before? */
export const snapSame = (r: QuickSnapRound, k: number) => looks(r.seq[k]) === looks(r.seq[k - 1]);

// ---------------------------------------------------------------- tap_star
export interface TapStarSettings {
  items: number;
  /** The share of moons among the items (0: only stars). */
  moons: number;
  /** plain: a blue moon, a yellow star · color: both yellow · twin: both yellow, lighter or darker, small or big. */
  look: "plain" | "color" | "twin";
}
export interface StarItem {
  id: string;
  star: boolean;
  /** Its place on the sky: 0–5 (3 across, 2 down). */
  at: number;
}
export interface TapStarRound {
  items: StarItem[];
}
export const STAR_PLACES = 6;

export const tapStar: Generator<TapStarSettings, TapStarRound> = {
  rounds: 1,
  make({ items: n, moons, look }, rng) {
    const moonCount = Math.round(n * moons);
    // The first item is always a star, so every round starts with something to tap.
    const kinds = [true, ...shuffled(rng, Array.from({ length: n - 1 }, (_, k) => k >= moonCount))];
    let at = -1;
    const items = kinds.map((star, k): StarItem => {
      at = one(rng, Array.from({ length: STAR_PLACES }, (_, p) => p).filter((p) => p !== at)); // never twice in one place
      const twin = look === "twin";
      const g = glyph({
        shape: star ? "star" : "moon",
        color: star || look !== "plain" ? "yellow" : "blue",
        shade: twin ? (int(rng, 0, 2) as 0 | 1 | 2) : 0,
        size: twin ? (int(rng, 1, 2) as 1 | 2) : 2,
        rot: !star && twin ? one(rng, [0, 30, 330]) : 0,
        tag: k,
      });
      return { id: glyphId(g), star, at };
    });
    return { items };
  },
  key: (r) => r.items.map((x) => `${x.id}@${x.at}`).join(","),
  // One right thing to do with each item: tap it when it is a star, leave it when it is a moon.
  answers: (r) => r.items.map((x) => ((parseGlyph(x.id).shape === "star") === x.star ? 1 : 0)),
};

// ---------------------------------------------------------------- fast_sort
export interface FastSortSettings {
  items: number;
  /** cat: pictures into their group's box · color: shapes into their colour's box. */
  by: "cat" | "color";
  groups: string[];
}
export interface FastSortRound {
  /** "cat:fruits", "color:red" (the box ids of Sort). */
  boxes: string[];
  items: string[];
}
export function fastSortFits(box: string, item: string) {
  const [by, g] = box.split(":");
  return by === "cat" ? categoryOf(item) === g : item.startsWith("g:") && parseGlyph(item).color === g;
}

export const fastSort: Generator<FastSortSettings, FastSortRound> = {
  rounds: 1,
  make({ items: n, by, groups }, rng) {
    const boxes = shuffled(rng, groups).map((g) => `${by}:${g}`);
    // As many items for every box (give or take one), in a mixed order.
    const per = groups.map((_, k) => Math.floor(n / groups.length) + (k < n % groups.length ? 1 : 0));
    const items = shuffled(
      rng,
      groups.flatMap((g, k) =>
        by === "cat"
          ? sample(rng, CATEGORIES[g as Category], per[k])
          : Array.from({ length: per[k] }, (_, j) => glyphId(glyph({ shape: one(rng, BASIC), color: g as GlyphColor, tag: `${g}${j}` }))),
      ),
    );
    return { boxes, items };
  },
  key: (r) => `${r.boxes.join(",")}|${r.items.map(looks).join(",")}`,
  answers: (r) => r.items.map((x) => r.boxes.filter((b) => fastSortFits(b, x)).length),
};
