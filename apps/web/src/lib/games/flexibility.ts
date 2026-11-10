import { VOCAB } from "@/content/vocab";
import { glyph, glyphId, GLYPH_COLORS, parseGlyph, type GlyphColor, type GlyphShape } from "./glyph";
import { copyId, lookOf, PICTURES } from "./pools";
import { int, one, sample, shuffled } from "./rng";
import type { Generator } from "./index";

// Round generators of the new Flexibility games (games spec 8 Nov 2026, §6.3): switch_sort, opposite, secret_rule.

const BASIC: GlyphShape[] = ["circle", "square", "triangle", "star", "heart"];

// ---------------------------------------------------------------- switch_sort
export type SortRule = "color" | "shape";
export interface SwitchSortSettings {
  cards: number;
  /** The rule changes after this many cards; 0: it may change at any card. */
  every: number;
  /** The rule is said aloud with each card (else only the card's frame shows it). */
  said: boolean;
  boxes: 2 | 3;
}
export interface SwitchSortRound {
  /** The pictures on the boxes: every box has its own shape and its own colour. */
  boxes: string[];
  /** Each card has the colour of one box and the shape of another. */
  cards: string[];
  rules: SortRule[];
  said: boolean;
}
/** The box a card goes in under a rule. */
export function sortBox(boxes: string[], card: string, rule: SortRule): string | undefined {
  const c = parseGlyph(card);
  return boxes.find((b) => parseGlyph(b)[rule] === c[rule]);
}
export const switchSort: Generator<SwitchSortSettings, SwitchSortRound> = {
  rounds: 1,
  make({ cards: n, every, said, boxes: nb }, rng) {
    for (;;) {
      const shapes = sample(rng, BASIC, nb);
      const colors = sample(rng, GLYPH_COLORS, nb);
      const boxes = shapes.map((shape, i) => glyphId(glyph({ shape, color: colors[i] })));
      let rule: SortRule = one(rng, ["color", "shape"] as const);
      const cards: string[] = [];
      const rules: SortRule[] = [];
      for (let i = 0; i < n; i++) {
        if (i > 0 && (every ? i % every === 0 : rng() < 0.5)) rule = rule === "color" ? "shape" : "color";
        const [a, b] = sample(rng, Array.from({ length: nb }, (_, k) => k), 2);
        cards.push(glyphId(glyph({ shape: shapes[b], color: colors[a], tag: i })));
        rules.push(rule);
      }
      // Every run has both rules (a "random" run that never changed is made again).
      if (new Set(rules).size === 2) return { boxes, cards, rules, said };
    }
  },
  key: (r) => `${r.boxes.join(",")}|${r.cards.map(lookOf).join(",")}|${r.rules.join("")}`,
  // Each card fits exactly one box by the rule of the moment.
  answers: (r) => r.cards.map((c, i) => r.boxes.filter((b) => parseGlyph(b)[r.rules[i]] === parseGlyph(c)[r.rules[i]]).length),
};

// ---------------------------------------------------------------- opposite
/** Picture pairs that are opposites (and no picture is in two pairs). */
export const OPPOSITE_PICTURES: [string, string][] = [
  ["sun", "moon"],
  ["mother", "father"],
  ["sister", "brother"],
  ["grandma", "grandpa"],
];
/** The colours of the colour-word steps (vocab colour items). */
const INK = ["red", "blue", "green", "yellow", "purple", "orange", "pink"] as const;
export const colorItem = (c: string) => `c_${c}`;

export interface OppositeSettings {
  /** pictures · glyphs (an arrow the other way, big and small, light and dark) · mixed · close: the wrong options are
   *  near misses of the same kind · stroop: a colour word written in another colour; pick the ink. */
  mode: "pictures" | "glyphs" | "mixed" | "close" | "stroop";
  options: number;
}
export interface OppositeRound {
  /** The picture, or (stroop) the colour item whose word is written. */
  prompt: string;
  /** Stroop: the colour item of the ink. */
  ink?: string;
  answer: string;
  options: string[];
}
type Family = "arrow" | "size" | "shade";
/** The opposite of a picture or a drawn shape; undefined when it has none. */
export function oppositeOf(id: string): string | undefined {
  const pair = OPPOSITE_PICTURES.find((p) => p.includes(id));
  if (pair) return pair[0] === id ? pair[1] : pair[0];
  if (!id.startsWith("g:")) return undefined;
  const g = parseGlyph(id);
  if (g.shape === "arrow") return glyphId({ ...g, rot: g.rot + 180 });
  if (g.size !== 1 && g.shade === 0) return glyphId({ ...g, size: g.size === 2 ? 0 : 2 });
  if (g.size === 1 && g.shade !== 0) return glyphId({ ...g, shade: g.shade === 1 ? 2 : 1 });
  return undefined;
}
function glyphPrompt(rng: () => number, family: Family) {
  const color = one(rng, GLYPH_COLORS);
  if (family === "arrow") return glyphId(glyph({ shape: "arrow", color: "green", rot: int(rng, 0, 3) * 90 }));
  if (family === "size") return glyphId(glyph({ shape: one(rng, BASIC), color, size: one(rng, [0, 2] as const) }));
  return glyphId(glyph({ shape: one(rng, BASIC), color, shade: one(rng, [1, 2] as const) }));
}
/** A near miss: the same kind of shape, but not the opposite (an arrow another way, the middle size, …). */
function nearMiss(rng: () => number, prompt: string): string {
  const g = parseGlyph(prompt);
  if (g.shape === "arrow") return glyphId({ ...g, rot: g.rot + one(rng, [0, 90, 270]) });
  const other = { shape: one(rng, BASIC), color: one(rng, GLYPH_COLORS) as GlyphColor };
  if (g.shade === 0) return glyphId(glyph({ ...(rng() < 0.5 ? { shape: g.shape, color: g.color as GlyphColor } : other), size: one(rng, [1, g.size] as const) }));
  return glyphId(glyph({ ...(rng() < 0.5 ? { shape: g.shape, color: g.color as GlyphColor } : other), shade: one(rng, [0, g.shade] as const) }));
}
export const opposite: Generator<OppositeSettings, OppositeRound> = {
  rounds: 4,
  make({ mode, options: n }, rng) {
    if (mode === "stroop") {
      const [word, ink] = sample(rng, INK, 2);
      const others = sample(rng, INK, n - 2, [word, ink]);
      return { prompt: colorItem(word), ink: colorItem(ink), answer: colorItem(ink), options: shuffled(rng, [ink, word, ...others].map(colorItem)) };
    }
    for (;;) {
      const usePicture = mode === "pictures" || (mode === "mixed" && rng() < 0.5);
      // An arrow has only 2 near misses (the two other ways): a board of more options takes another kind of shape.
      const family: Family = one(rng, mode === "close" && n > 3 ? (["size", "shade"] as const) : (["arrow", "size", "shade"] as const));
      const prompt = usePicture ? one(rng, OPPOSITE_PICTURES.flat()) : glyphPrompt(rng, family);
      const answer = oppositeOf(prompt)!;
      const wrong = new Set<string>();
      const bad = (x: string) => [prompt, answer].map(lookOf).includes(lookOf(x)) || [...wrong].some((w) => lookOf(w) === lookOf(x)) || lookOf(oppositeOf(prompt) ?? "") === lookOf(x);
      for (let k = 0; k < 200 && wrong.size < n - 1; k++) {
        const anyGlyph = () => glyphPrompt(rng, one(rng, ["arrow", "size", "shade"] as const));
        const x = usePicture ? one(rng, PICTURES) : mode === "close" ? nearMiss(rng, prompt) : mode === "glyphs" || rng() < 0.5 ? anyGlyph() : one(rng, PICTURES);
        // A wrong option is never the opposite of the picture (an arrow the other way in another colour would be).
        if (!bad(x) && !(x.startsWith("g:") && prompt.startsWith("g:") && isOppositeKind(prompt, x))) wrong.add(x);
      }
      if (wrong.size === n - 1) return { prompt, answer, options: shuffled(rng, [answer, ...wrong]) };
    }
  },
  key: (r) => `${lookOf(r.prompt)}|${r.ink ?? ""}`,
  answers: (r) => [r.ink ? r.options.filter((o) => o === r.ink).length * (r.ink !== r.prompt ? 1 : 0) : r.options.filter((o) => isOpposite(r.prompt, o)).length],
};
/**
 * `x` could be taken for the opposite of `prompt`: an arrow pointing the other way, or any shape with the other size
 * (small for big) or the other shade, whatever its shape and colour. Such a shape is never a wrong option.
 */
function isOppositeKind(prompt: string, x: string) {
  const a = parseGlyph(prompt);
  const b = parseGlyph(x);
  if (a.shape === "arrow") return b.shape === "arrow" && (a.rot + 180) % 360 === b.rot;
  if (b.shape === "arrow") return false;
  if (a.shade === 0) return b.shade === 0 && b.size === (a.size === 2 ? 0 : 2);
  return b.size === 1 && b.shade === (a.shade === 1 ? 2 : 1);
}
const isOpposite = (prompt: string, x: string) => (prompt.startsWith("g:") && x.startsWith("g:") ? isOppositeKind(prompt, x) : lookOf(oppositeOf(prompt) ?? "") === lookOf(x));
/** The written word of a stroop round in a language. */
export const colorWord = (item: string, lang: "en" | "ru" | "uz") => VOCAB[item]?.word[lang] ?? item;

// ---------------------------------------------------------------- secret_rule
export type CardRule = "color" | "shape" | "count" | "size";
const CARD_RULES: CardRule[] = ["color", "shape", "count", "size"];
export interface Card {
  shape: GlyphShape;
  color: GlyphColor;
  count: number;
  /** 0 smallest … 3 biggest. */
  size: number;
}
/** A card with 1–4 shapes on it: `k:star:red:3:2`. */
export const cardId = (c: Card) => `k:${c.shape}:${c.color}:${c.count}:${c.size}`;
export const isCard = (id: string) => id.startsWith("k:");
export function parseCard(id: string): Card {
  const [, shape, color, count, size] = id.split("~")[0].split(":");
  return { shape: shape as GlyphShape, color: color as GlyphColor, count: Number(count), size: Number(size) };
}
export interface SecretRuleSettings {
  /** 2: colour and shape · 3: and number · 4: and size. */
  rules: 2 | 3 | 4;
  /** The rule changes, without warning, after this many right cards. */
  every: number;
  cards: number;
}
export interface SecretRuleRound {
  /** The four cards on the table: every two differ in each feature. */
  keys: string[];
  cards: string[];
  rules: CardRule[];
}
export const secretRule: Generator<SecretRuleSettings, SecretRuleRound> = {
  rounds: 1,
  make({ rules: nr, every, cards: n }, rng) {
    const shapes = sample(rng, BASIC, 4);
    const colors = sample(rng, GLYPH_COLORS, 4);
    const counts = shuffled(rng, [1, 2, 3, 4]);
    const sizes = nr === 4 ? shuffled(rng, [0, 1, 2, 3]) : [2, 2, 2, 2];
    const keys = shapes.map((shape, i) => cardId({ shape, color: colors[i], count: counts[i], size: sizes[i] }));
    const used = CARD_RULES.slice(0, nr);
    let rule = one(rng, used);
    const cards: string[] = [];
    const rules: CardRule[] = [];
    for (let i = 0; i < n; i++) {
      if (i > 0 && i % every === 0) rule = one(rng, used.filter((x) => x !== rule));
      // Each feature from one of the key cards (never a copy of a key card).
      let c: Card;
      do c = { shape: one(rng, shapes), color: one(rng, colors), count: one(rng, counts), size: nr === 4 ? one(rng, sizes) : 2 };
      while (keys.includes(cardId(c)));
      cards.push(copyId(cardId(c), i));
      rules.push(rule);
    }
    return { keys, cards, rules };
  },
  key: (r) => `${r.keys.join(",")}|${r.cards.join(",")}`,
  // Under the rule of the moment, exactly one key card shares the feature.
  answers: (r) => r.cards.map((c, i) => r.keys.filter((k) => parseCard(k)[r.rules[i]] === parseCard(c)[r.rules[i]]).length),
};
