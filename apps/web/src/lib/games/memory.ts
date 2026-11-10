import { CATEGORIES, copyId, lookOf, PICTURES } from "./pools";
import { one, sample, shuffled } from "./rng";
import type { Generator } from "./index";

// Round generators of the new Memory games (games spec 8 Nov 2026, §6.2): card_pairs, shopping_list, n_back,
// pairs_recall.

const distinct = (ids: readonly string[]) => new Set(ids.map(lookOf)).size === ids.length;

// ---------------------------------------------------------------- card_pairs
export interface CardPairsSettings {
  pairs: number;
  /** All pictures from one or two groups (all fruit…): harder to tell apart in memory. */
  similar?: boolean;
}
export interface CardPairsRound {
  /** Each picture twice ("apple~0", "apple~1"), shuffled. */
  cards: string[];
}
export const cardPairs: Generator<CardPairsSettings, CardPairsRound> = {
  rounds: 1,
  make({ pairs, similar }, rng) {
    const pool = similar ? [...CATEGORIES.fruits, ...CATEGORIES.vegetables] : PICTURES;
    const pics = sample(rng, pool, pairs);
    return { cards: shuffled(rng, pics.flatMap((p) => [copyId(p, 0), copyId(p, 1)])) };
  },
  key: (r) => r.cards.join(","),
  // Every card has exactly one partner.
  answers: (r) => r.cards.map((c) => r.cards.filter((x) => x !== c && lookOf(x) === lookOf(c)).length),
};

// ---------------------------------------------------------------- shopping_list
export interface ShoppingSettings {
  items: number;
  shelf: number;
  /** The list is shown as pictures while it is said; otherwise it is only said. */
  show: boolean;
  /** "Hear the list again" is offered on the shelf. */
  replay: boolean;
  /** Seconds of swimming fish between the list and the shelf. */
  wait?: number;
}
export interface ShoppingRound {
  list: string[];
  shelf: string[];
  show: boolean;
  replay: boolean;
  wait: number;
}
const SHOP = [...CATEGORIES.fruits, ...CATEGORIES.vegetables, ...CATEGORIES.toys, ...CATEGORIES.clothes];
export const shoppingList: Generator<ShoppingSettings, ShoppingRound> = {
  rounds: 2,
  make({ items, shelf, show, replay, wait }, rng) {
    const list = sample(rng, SHOP, items);
    return { list, shelf: shuffled(rng, [...list, ...sample(rng, SHOP, shelf - items, list)]), show, replay, wait: wait ?? 0 };
  },
  key: (r) => [...r.list].sort().join(","),
  // One right set: the list, every item of it on the shelf, no two shelf pictures alike.
  answers: (r) => [distinct(r.shelf) && r.list.every((x) => r.shelf.includes(x)) ? 1 : 0],
};

// ---------------------------------------------------------------- n_back
export interface NBackSettings {
  /** Compare with the picture this many before. */
  n: 1 | 2 | 3;
  /** Pictures in the stream. */
  items: number;
  /** Each picture also sits in a cell of a 3×3 grid, and the place is asked about too. */
  place?: boolean;
}
export interface NBackRound {
  n: number;
  seq: string[];
  /** Cells 0–8 of the 3×3 grid (with `place`). */
  cells?: number[];
}
/** The questions of a stream: for each picture from the n-th on, "same picture?" and (with places) "same place?". */
export function nBackQuestions(r: NBackRound) {
  const out: { at: number; ask: "picture" | "place"; yes: boolean }[] = [];
  for (let i = r.n; i < r.seq.length; i++) {
    out.push({ at: i, ask: "picture", yes: r.seq[i] === r.seq[i - r.n] });
    if (r.cells) out.push({ at: i, ask: "place", yes: r.cells[i] === r.cells[i - r.n] });
  }
  return out;
}
/** About 40% "yes": a stream that keeps a match from n before, else a picture (or cell) unlike it. */
function stream<T>(rng: () => number, pool: readonly T[], length: number, n: number): T[] {
  const s: T[] = [];
  for (let i = 0; i < length; i++) s.push(i >= n && rng() < 0.4 ? s[i - n] : one(rng, pool.filter((x) => i < n || x !== s[i - n])));
  return s;
}
export const nBack: Generator<NBackSettings, NBackRound> = {
  rounds: 1,
  make({ n, items, place }, rng) {
    for (;;) {
      const r: NBackRound = { n, seq: stream(rng, sample(rng, PICTURES, 6), items, n), cells: place ? stream(rng, Array.from({ length: 9 }, (_, c) => c), items, n) : undefined };
      const q = nBackQuestions(r);
      // Every stream has both answers, for pictures and for places.
      if ((["picture", "place"] as const).every((a) => !q.some((x) => x.ask === a) || (q.some((x) => x.ask === a && x.yes) && q.some((x) => x.ask === a && !x.yes)))) return r;
    }
  },
  key: (r) => `${r.seq.join(",")}|${r.cells?.join(",") ?? ""}`,
  // Yes or no: one right answer to each question.
  answers: (r) => nBackQuestions(r).map(() => 1),
};

// ---------------------------------------------------------------- pairs_recall
/** The children who order (people pictures, all clearly different). */
export const PEOPLE = ["👦", "👧", "👨", "👩", "👴", "👵", "👶", "👱"];
const FOOD = [...CATEGORIES.fruits, ...CATEGORIES.vegetables];
export interface PairsRecallSettings {
  pairs: number;
  /** Food options for each question (the others' food first, so they are the harder ones to rule out). */
  options: number;
  /** Children asked about. */
  ask: number;
}
export interface PairsRecallRound {
  people: string[];
  foods: string[];
  ask: { person: number; options: string[] }[];
}
export const pairsRecall: Generator<PairsRecallSettings, PairsRecallRound> = {
  rounds: 1,
  make({ pairs, options, ask }, rng) {
    const people = sample(rng, PEOPLE, pairs);
    const foods = sample(rng, FOOD, pairs);
    const asked = sample(rng, Array.from({ length: pairs }, (_, k) => k), ask);
    return {
      people,
      foods,
      ask: asked.map((person) => {
        const others = sample(rng, foods, options - 1, [foods[person]]);
        const more = sample(rng, FOOD, options - 1 - others.length, foods);
        return { person, options: shuffled(rng, [foods[person], ...others, ...more]) };
      }),
    };
  },
  key: (r) => `${r.people.join("")}|${r.foods.join(",")}`,
  answers: (r) => r.ask.map((q) => (distinct(q.options) ? q.options.filter((o) => o === r.foods[q.person]).length : 0)),
};
