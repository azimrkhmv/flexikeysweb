import { STORIES, type StoryQuestion } from "@/content/stories";
import { SOUND_GROUPS, TYPE_SENTENCES, TYPE_WORDS, type PicWord } from "@/content/words";
import type { Lang } from "@/lib/i18n";
import { LAYOUTS, tokenize } from "@/lib/keys";
import type { L10n } from "@/lib/types";
import { glyph, glyphId, GLYPH_COLORS, GLYPH_SHAPES, parseGlyph, TURNABLE, type GlyphColor, type GlyphShape } from "./glyph";
import { edge, isPerfect, perfectMaze, route } from "./maze";
import { CATEGORIES, CATEGORY_IDS, categoryOf, lookOf, PICTURES, wordId, wordOf, type Category } from "./pools";
import { deranged, int, one, sample, shuffled } from "./rng";
import type { Generator } from "./index";

// Round generators of the 12 kinds the theme worlds already had (games spec 8 Nov 2026, §5). Each one builds a round
// from a step's settings and a seeded random source, and can count the right answers of a round by itself, without
// trusting the round's own `answer` (games.test.ts: exactly one, 200 rounds).

const distinctLooks = (ids: readonly string[]) => new Set(ids.map(lookOf)).size === ids.length;
/** Pictures whose look differs from every one of `not`. */
const freshPictures = (not: readonly string[]) => PICTURES.filter((x) => !not.some((y) => lookOf(y) === lookOf(x)));
const BASIC: GlyphShape[] = ["circle", "square", "triangle", "star", "heart", "rectangle"];

// ---------------------------------------------------------------- find_same
export interface FindSameSettings {
  options: number;
  /** items: pictures · shapes: same colour, other shapes · colors: same shape, other colours (and shades from 8) ·
   *  turn: same shape, turned by 30° steps · fine: same shape, a small turn (15°) or shade away. */
  mode: "items" | "shapes" | "colors" | "turn" | "fine";
}
export interface FindSameRound {
  target: string;
  options: string[];
}
export const findSame: Generator<FindSameSettings, FindSameRound> = {
  rounds: 4,
  make({ options: n, mode }, rng) {
    let target: string;
    let others: string[];
    if (mode === "items") {
      target = one(rng, PICTURES);
      // Very different: no other picture of the same group.
      others = sample(rng, PICTURES.filter((x) => categoryOf(x) !== categoryOf(target)), n - 1);
    } else if (mode === "shapes") {
      const color = one(rng, GLYPH_COLORS);
      const [s, ...rest] = sample(rng, GLYPH_SHAPES, n);
      target = glyphId(glyph({ shape: s, color }));
      others = rest.map((shape) => glyphId(glyph({ shape, color })));
    } else if (mode === "colors") {
      const shape = one(rng, BASIC);
      const looks = GLYPH_COLORS.flatMap((color) => (n <= GLYPH_COLORS.length ? [0] : [0, 1, 2]).map((shade) => glyphId(glyph({ shape, color, shade: shade as 0 | 1 | 2 }))));
      [target, ...others] = sample(rng, looks, n);
    } else {
      const shape = one(rng, TURNABLE);
      const color = one(rng, GLYPH_COLORS);
      const rot = int(rng, 0, 11) * 30;
      if (mode === "turn") {
        const looks = Array.from({ length: 12 }, (_, k) => glyphId(glyph({ shape, color, rot: rot + k * 30 })));
        target = looks[0];
        others = sample(rng, looks.slice(1), n - 1);
      } else {
        const shade = int(rng, 0, 2) as 0 | 1 | 2;
        target = glyphId(glyph({ shape, color, rot, shade }));
        const near = [-45, -30, -15, 0, 15, 30, 45].flatMap((d) => ([0, 1, 2] as const).map((sh) => glyphId(glyph({ shape, color, rot: rot + d, shade: sh }))));
        others = sample(rng, near, n - 1, [target]);
      }
    }
    return { target, options: shuffled(rng, [target, ...others]) };
  },
  key: (r) => `${r.target}|${[...r.options].sort().join(",")}`,
  answers: (r) => [distinctLooks(r.options) ? r.options.filter((o) => lookOf(o) === lookOf(r.target)).length : 0],
};

// ---------------------------------------------------------------- scene
export interface SceneSettings {
  objects: number;
  options: number;
  small?: boolean;
  /** How many objects are half hidden behind a bush. */
  hidden?: number;
}
export interface SceneObject {
  id: string;
  /** Centre, in % of the panel. */
  x: number;
  y: number;
  /** Size in % of the panel's height. */
  s: number;
  hidden: boolean;
}
export interface SceneSkillRound {
  objects: SceneObject[];
  answer: string;
  options: string[];
}
export const scene: Generator<SceneSettings, SceneSkillRound> = {
  rounds: 4,
  make({ objects: n, options, small, hidden = 0 }, rng) {
    const ids = sample(rng, PICTURES, n);
    // A jittered grid on a 16:9 panel, so no picture covers another.
    const cols = Math.ceil(Math.sqrt(n * 1.8));
    const rows = Math.ceil(n / cols);
    const cells = sample(rng, Array.from({ length: cols * rows }, (_, k) => k), n);
    const objects = ids.map((id, k): SceneObject => {
      const cw = 100 / cols;
      const ch = 100 / rows;
      const s = (small ? 0.5 + rng() * 0.2 : 0.75 + rng() * 0.15) * Math.min(ch, cw * 1.6);
      return { id, x: (cells[k] % cols + 0.5) * cw + (rng() - 0.5) * cw * 0.3, y: (Math.floor(cells[k] / cols) + 0.5) * ch + (rng() - 0.5) * ch * 0.3, s, hidden: k < hidden };
    });
    // At the harder steps the answer is often one of the half-hidden pictures.
    const answer = hidden && rng() < 0.6 ? one(rng, ids.slice(0, hidden)) : one(rng, ids);
    return { objects: shuffled(rng, objects), answer, options: shuffled(rng, [answer, ...sample(rng, freshPictures(ids), options - 1)]) };
  },
  key: (r) => `${r.answer}|${r.objects.map((o) => o.id).sort().join(",")}`,
  answers: (r) => [distinctLooks(r.options) ? r.options.filter((o) => r.objects.some((x) => lookOf(x.id) === lookOf(o))).length : 0],
};

// ---------------------------------------------------------------- story
export interface StorySettings {
  /** The tier of the stories (Seed 3 pages … Summit 6 pages). */
  set: 1 | 2 | 3 | 4;
  questions: number;
  options: number;
}
export interface StoryRoundQuestion {
  prompt: L10n;
  /** A vocab id, or a page ("p:2") for the order questions. */
  answer: string;
  options: string[];
  ask?: "first" | "last";
}
export interface StorySkillRound {
  story: string;
  questions: StoryRoundQuestion[];
}
const pageId = (k: number) => `p:${k}`;
const pageOf = (id: string) => Number(id.slice(2));
export const story: Generator<StorySettings, StorySkillRound> = {
  rounds: 1,
  make({ set, questions, options: n }, rng) {
    const s = one(rng, STORIES.filter((x) => x.tier === set));
    const asked = s.questions.slice(0, questions).map((q: StoryQuestion): StoryRoundQuestion => {
      if ("ask" in q) {
        const pages = sample(rng, s.pages.map((_, k) => pageId(k)), n);
        const want = (q.ask === "first" ? Math.min : Math.max)(...pages.map(pageOf));
        return { prompt: q.prompt, ask: q.ask, answer: pageId(want), options: pages };
      }
      return { prompt: q.prompt, answer: q.answer, options: shuffled(rng, [q.answer, ...sample(rng, q.options, n - 1, [q.answer])]) };
    });
    return { story: s.id, questions: asked };
  },
  key: (r) => `${r.story}|${r.questions.map((q) => q.options.join(",")).join("|")}`,
  answers: (r) =>
    r.questions.map((q) => {
      if (new Set(q.options).size !== q.options.length) return 0;
      if (!q.ask) return q.options.filter((o) => o === q.answer).length;
      const want = (q.ask === "first" ? Math.min : Math.max)(...q.options.map(pageOf));
      return q.options.filter((o) => pageOf(o) === want).length;
    }),
};

// ---------------------------------------------------------------- sequence
export interface SequenceSettings {
  length: number;
  /** How many pictures to choose from. */
  pool: number;
  order?: "forward" | "backward" | "both";
}
export interface SequenceSkillRound {
  seq: string[];
  options: string[];
  order: "forward" | "backward" | "both";
}
export const sequence: Generator<SequenceSettings, SequenceSkillRound> = {
  rounds: 3,
  make({ length, pool, order = "forward" }, rng) {
    const options = sample(rng, PICTURES, pool);
    return { seq: sample(rng, options, length), options, order };
  },
  key: (r) => r.seq.join(","),
  // Pictures that all differ have exactly one order.
  answers: (r) => [distinctLooks(r.options) && distinctLooks(r.seq) && r.seq.every((x) => r.options.includes(x)) ? 1 : 0],
};

// ---------------------------------------------------------------- missing
export interface MissingSettings {
  shown: number;
  gone?: 1 | 2;
  options: number;
  /** gone: pictures go away · swap: two pictures change places · mixed: either. */
  change?: "gone" | "swap" | "mixed";
}
export type MissingSkillRound =
  | { shown: string[]; change: "gone"; gone: number[]; options: string[][] }
  | { shown: string[]; change: "swap"; swap: [number, number] };
export const missing: Generator<MissingSettings, MissingSkillRound> = {
  rounds: 3,
  make({ shown: n, gone = 1, options, change = "gone" }, rng) {
    const shown = sample(rng, PICTURES, n);
    const kind = change === "mixed" ? one(rng, ["gone", "swap"] as const) : change;
    if (kind === "swap") {
      const [a, b] = sample(rng, shown.map((_, k) => k), 2).sort((x, y) => x - y);
      return { shown, change: "swap", swap: [a, b] };
    }
    const idx = sample(rng, shown.map((_, k) => k), gone).sort((x, y) => x - y);
    const goneIds = idx.map((k) => shown[k]);
    // One question per empty place, left to right; the other missing picture is a fine wrong option.
    const opts = idx.map((k) => {
      const rest = goneIds.filter((x) => x !== shown[k]).slice(0, options - 1);
      return shuffled(rng, [shown[k], ...rest, ...sample(rng, freshPictures(shown), options - 1 - rest.length)]);
    });
    return { shown, change: "gone", gone: idx, options: opts };
  },
  key: (r) => `${r.shown.join(",")}|${r.change === "gone" ? r.gone.join(",") : r.swap.join("~")}`,
  answers(r) {
    if (!distinctLooks(r.shown)) return [0];
    if (r.change === "gone") return r.gone.map((k, q) => (distinctLooks(r.options[q]) ? r.options[q].filter((o) => lookOf(o) === lookOf(r.shown[k])).length : 0));
    // The row after the swap: how many pairs of places, swapped back, give the first row?
    const after = [...r.shown];
    [after[r.swap[0]], after[r.swap[1]]] = [after[r.swap[1]], after[r.swap[0]]];
    let pairs = 0;
    for (let a = 0; a < after.length; a++)
      for (let b = a + 1; b < after.length; b++) {
        const back = [...after];
        [back[a], back[b]] = [back[b], back[a]];
        if (back.every((x, k) => lookOf(x) === lookOf(r.shown[k]))) pairs++;
      }
    return [pairs];
  },
};

// ---------------------------------------------------------------- light_path
export interface LightPathSettings {
  grid: 3 | 4 | 5;
  length: number;
  /** Tap the stars from the last to the first. */
  reverse?: boolean;
}
export interface LightPathSkillRound {
  grid: number;
  seq: number[];
  reverse: boolean;
}
export const lightPath: Generator<LightPathSettings, LightPathSkillRound> = {
  rounds: 3,
  make: ({ grid, length, reverse = false }, rng) => ({ grid, seq: sample(rng, Array.from({ length: grid * grid }, (_, k) => k), length), reverse }),
  key: (r) => r.seq.join(","),
  answers: (r) => [new Set(r.seq).size === r.seq.length && r.seq.every((c) => c >= 0 && c < r.grid * r.grid) ? 1 : 0],
};

// ---------------------------------------------------------------- sort
export interface SortSettings {
  groups: 2 | 3 | 4;
  items: number;
  /** category: fruits / animals… · color · shape · two: colour and shape at once (2 × 2 boxes). */
  by: "category" | "color" | "shape" | "two";
}
export interface SortSkillRound {
  /** Box ids: "cat:fruits", "color:red", "shape:circle", "two:red:circle". */
  groups: string[];
  items: string[];
}
function fits(group: string, item: string): boolean {
  const [by, a, b] = group.split(":");
  if (by === "cat") return (CATEGORIES[a as Category] as readonly string[]).includes(item);
  if (!item.startsWith("g:")) return false;
  const g = parseGlyph(item);
  return by === "color" ? g.color === a : by === "shape" ? g.shape === a : g.color === a && g.shape === b;
}
export const sort: Generator<SortSettings, SortSkillRound> = {
  rounds: 1,
  make({ groups: n, items, by }, rng) {
    const boxes = by === "two" ? 4 : n;
    const per = Array.from({ length: boxes }, (_, k) => Math.floor(items / boxes) + (k < items % boxes ? 1 : 0));
    let groups: string[];
    let list: string[];
    if (by === "category") {
      const cats = sample(rng, CATEGORY_IDS, n);
      groups = cats.map((c) => `cat:${c}`);
      list = cats.flatMap((c, k) => sample(rng, CATEGORIES[c], per[k]));
    } else {
      const colors = sample(rng, GLYPH_COLORS, by === "two" ? 2 : n) as GlyphColor[];
      const shapes = sample(rng, BASIC, by === "two" ? 2 : n);
      groups = by === "color" ? colors.map((c) => `color:${c}`) : by === "shape" ? shapes.map((s) => `shape:${s}`) : colors.flatMap((c) => shapes.map((s) => `two:${c}:${s}`));
      // The feature the boxes don't ask about changes from picture to picture, so the child must look at the rule.
      list = groups.flatMap((g, k) =>
        Array.from({ length: per[k] }, (_, i) => {
          const [, a, b] = g.split(":");
          const color = by === "shape" ? one(rng, GLYPH_COLORS) : (a as GlyphColor);
          const shape = by === "color" ? one(rng, BASIC) : by === "shape" ? (a as GlyphShape) : (b as GlyphShape);
          return glyphId(glyph({ shape, color, tag: `${k}.${i}` }));
        }),
      );
    }
    return { groups, items: shuffled(rng, list) };
  },
  key: (r) => [...r.items].sort().join(","),
  answers: (r) => r.items.map((i) => r.groups.filter((g) => fits(g, i)).length),
};
export const sortFits = fits;

// ---------------------------------------------------------------- maze
export interface MazeSettings {
  size: number;
  /** A door on the way that opens with a key somewhere else in the maze. */
  key?: boolean;
}
export interface MazeSkillRound {
  n: number;
  open: string[];
  key?: number;
  door?: string;
}
export const maze: Generator<MazeSettings, MazeSkillRound> = {
  rounds: 2,
  make({ size: n, key }, rng) {
    const open = perfectMaze(n, rng);
    if (!key) return { n, open };
    const set = new Set(open);
    const way = [0, ...route(n, set, 0, n * n - 1)!];
    // The door sits on the way to the star, about halfway; the key lies on the start's side, off the way if it can.
    const d = Math.max(1, Math.floor(way.length / 2));
    const door = edge(way[d - 1], way[d]);
    const before = Array.from({ length: n * n }, (_, c) => c).filter((c) => c !== 0 && route(n, set, 0, c, door));
    const off = before.filter((c) => !way.includes(c));
    const far = (cs: number[]) => cs.sort((a, b) => route(n, set, 0, b)!.length - route(n, set, 0, a)!.length).slice(0, 3);
    const k = one(rng, far(off.length ? off : before.length ? before : [0]));
    return { n, open, key: k, door };
  },
  key: (r) => [...r.open].sort().join(","),
  answers(r) {
    // A perfect maze has exactly one way; with a door, the key must be reachable before it and the door on the way.
    if (!isPerfect(r.n, r.open)) return [0];
    if (r.key === undefined) return [1];
    const set = new Set(r.open);
    const toKey = route(r.n, set, 0, r.key, r.door);
    const way = route(r.n, set, 0, r.n * r.n - 1)!;
    const doorOnWay = [0, ...way].some((c, k, a) => k > 0 && edge(a[k - 1], c) === r.door);
    return [toKey && doorOnWay && r.key !== 0 ? 1 : 0];
  },
};

// ---------------------------------------------------------------- puzzle
export interface PuzzleSettings {
  grid: 2 | 3 | 4 | 5;
  /** Pieces that lie turned and must be turned back: none, some or all. */
  turned?: "none" | "some" | "all";
  /** Show the small whole picture next to the board (left out at the last step). */
  preview?: boolean;
}
export interface PuzzleSkillRound {
  grid: number;
  /** The picture: a big emoji in the middle and four small ones around it. */
  picture: string[];
  /** The pieces in the tray, in order. */
  tray: number[];
  /** Each piece's turn in degrees (0, 90, 180, 270). */
  rot: number[];
  preview: boolean;
}
export const puzzle: Generator<PuzzleSettings, PuzzleSkillRound> = {
  rounds: 1,
  make({ grid, turned = "none", preview = true }, rng) {
    const n = grid * grid;
    const picture = sample(rng, PICTURES, 5).map((id) => lookOf(id));
    const rot = Array.from({ length: n }, (): number => (turned === "all" || (turned === "some" && rng() < 0.4) ? int(rng, 1, 3) * 90 : 0));
    if (turned === "some" && !rot.some(Boolean)) rot[int(rng, 0, n - 1)] = 90;
    return { grid, picture, tray: deranged(rng, Array.from({ length: n }, (_, k) => k)), rot, preview };
  },
  key: (r) => `${r.picture.join("")}|${r.tray.join(",")}`,
  // Every piece is a different part of the picture (its own patch of the background), so it fits one place.
  answers: (r) => [[...r.tray].sort((a, b) => a - b).every((x, k) => x === k) && r.tray.length === r.grid * r.grid && r.rot.every((x) => x % 90 === 0) ? 1 : 0],
};

// ---------------------------------------------------------------- listen_pick
export interface ListenPickSettings {
  options: number;
  /** Options that sound like the word (bus / bun), from the language's own lists. */
  similar?: boolean;
  /** Never show the written word, not even as extra help. */
  noWord?: boolean;
}
export interface ListenPickSkillRound {
  lang: Lang;
  target: string;
  options: string[];
  noWord: boolean;
}
export const listenPick: Generator<ListenPickSettings, ListenPickSkillRound> = {
  rounds: 4,
  make({ options: n, similar, noWord = false }, rng, lang) {
    if (!similar) {
      const target = one(rng, PICTURES);
      const options = [target];
      for (const x of shuffled(rng, PICTURES)) if (options.length < n && !options.some((o) => wordOf(o, lang) === wordOf(x, lang))) options.push(x);
      return { lang, target, options: shuffled(rng, options), noWord };
    }
    const groups = SOUND_GROUPS[lang];
    const group = one(rng, groups);
    const t = one(rng, group);
    const chosen: PicWord[] = [t, ...sample(rng, group, n - 1, [t])];
    // Fill up from the other groups, never a word or a picture already there.
    for (const x of shuffled(rng, groups.flat()))
      if (chosen.length < n && !chosen.some((c) => c.word === x.word || c.emoji === x.emoji)) chosen.push(x);
    return { lang, target: wordId(lang, t.word), options: shuffled(rng, chosen.map((c) => wordId(lang, c.word))), noWord };
  },
  key: (r) => r.target,
  // The word heard picks one picture: every picture and every word of the options differs.
  answers: (r) => [distinctLooks(r.options) ? r.options.filter((o) => wordOf(o, r.lang) === wordOf(r.target, r.lang)).length : 0],
};

// ---------------------------------------------------------------- type
export interface TypeSettings {
  /** letter: find one letter · word: type a word you can see · listen: type a word you hear · sentence: a short
   *  sentence you hear (the spaces come by themselves). */
  mode: "letter" | "word" | "listen" | "sentence";
  /** Letters (word, listen) or words (sentence), from min to max. */
  min?: number;
  max?: number;
}
export interface TypeSkillRound {
  lang: Lang;
  mode: TypeSettings["mode"];
  text: string;
}
const HARD_LETTERS = new Set(["ъ", "ь", "ё", "щ", "q", "x", "z"]);
export const type: Generator<TypeSettings, TypeSkillRound> = {
  rounds: 4,
  make({ mode, min = 1, max = 99 }, rng, lang) {
    if (mode === "letter") return { lang, mode, text: one(rng, LAYOUTS[lang].flat().filter((k) => !HARD_LETTERS.has(k) && k.length === 1)) };
    const size = (x: string) => (mode === "sentence" ? x.split(" ").length : tokenize(x, lang).length);
    return { lang, mode, text: one(rng, (mode === "sentence" ? TYPE_SENTENCES : TYPE_WORDS)[lang].filter((x) => size(x) >= min && size(x) <= max)) };
  },
  key: (r) => r.text,
  // A text has one way to type it when every letter is on the keyboard (the spaces come by themselves).
  answers: (r) => [r.text.trim() === r.text && !r.text.includes("  ") && tokenize(r.text, r.lang).every((k) => k === " " || LAYOUTS[r.lang].flat().includes(k)) ? 1 : 0],
};

// ---------------------------------------------------------------- count
export interface CountSettings {
  lo: number;
  hi: number;
  /** Count one by one, or groups of 2, 5 or 10, or mixed groups. */
  by: 1 | 2 | 5 | 10 | "mixed";
  options: number;
}
export interface CountSkillRound {
  /** The size of each group (one by one: a single group of n). */
  groups: number[];
  by: CountSettings["by"];
  item: string;
  options: number[];
}
export const count: Generator<CountSettings, CountSkillRound> = {
  rounds: 4,
  make({ lo, hi, by, options: k }, rng) {
    let groups: number[];
    if (by === "mixed") {
      do groups = [...Array(int(rng, 1, 6)).fill(10), ...Array(int(rng, 0, 3)).fill(5), ...Array(int(rng, 0, 3)).fill(2)];
      while (groups.reduce((a, b) => a + b, 0) > hi || groups.reduce((a, b) => a + b, 0) < lo);
    } else if (by === 1) groups = [int(rng, lo, hi)];
    else groups = Array(int(rng, Math.ceil(lo / by), Math.floor(hi / by))).fill(by);
    const n = groups.reduce((a, b) => a + b, 0);
    const step = by === 1 ? 1 : by === "mixed" ? one(rng, [1, 2, 5]) : by;
    const near = [-3, -2, -1, 1, 2, 3].map((d) => n + d * step).filter((x) => x >= Math.max(1, by === 1 ? 1 : step) && x <= Math.max(hi, n + 3 * step));
    const options = [n, ...sample(rng, near, k - 1)].sort((a, b) => a - b);
    return { groups, by, item: one(rng, PICTURES), options };
  },
  key: (r) => `${r.groups.join("+")}|${r.options.join(",")}`,
  answers: (r) => [new Set(r.options).size === r.options.length ? r.options.filter((o) => o === r.groups.reduce((a, b) => a + b, 0)).length : 0],
};
