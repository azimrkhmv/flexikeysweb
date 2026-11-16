import { int, one, sample, shuffled } from "./rng";
import type { Generator } from "./index";

// Round generators of the two Cloudy games (Warm Hills spec 15 Nov 2026, §6): find_cloudy (Attention) and, in B105,
// grow_cloudy (Memory).

// ---------------------------------------------------------------- find_cloudy
export interface FindCloudySettings {
  clouds: number;
  /** stay: Cloudy stays half out of his cloud · peek: he peeks out for a moment, again and again ·
   *  once: he peeks once, then the clouds swap places. */
  peek: "stay" | "peek" | "once";
  /** Seconds between two peeks (peek). */
  every?: number;
  /** Pairs of clouds that swap places (once). */
  swaps?: number;
  /** Once, between the swaps, Cloudy jumps to another cloud, in view (once). */
  jump?: boolean;
}
export interface FindCloudyRound {
  clouds: number;
  peek: FindCloudySettings["peek"];
  every: number;
  /** The cloud Cloudy hides behind first. */
  hide: number;
  /** The moves after the peek, in order: two clouds swap places, or Cloudy jumps to another cloud. */
  moves: ({ swap: [number, number] } | { jump: number })[];
}

/** Where each cloud is after the moves (a cloud keeps its number; `at[cloud]` is its place) and where Cloudy is. */
export function afterMoves(r: FindCloudyRound, upTo = r.moves.length) {
  const at = Array.from({ length: r.clouds }, (_, c) => c);
  let cloudy = r.hide;
  for (const m of r.moves.slice(0, upTo)) {
    if ("jump" in m) cloudy = m.jump;
    else [at[m.swap[0]], at[m.swap[1]]] = [at[m.swap[1]], at[m.swap[0]]];
  }
  return { at, cloudy };
}

/** The rows of n clouds: up to 4 a row in a wide sky, up to 3 in a tall one (a phone, so each cloud stays big). */
export function cloudRows(n: number, tall = false): number[] {
  if (tall) return n <= 3 ? [n] : n === 4 ? [2, 2] : n === 5 ? [3, 2] : n === 6 ? [2, 2, 2] : n === 7 ? [2, 3, 2] : [3, 2, 3];
  return n <= 3 ? [n] : n === 4 ? [2, 2] : n === 5 ? [3, 2] : n === 6 ? [3, 3] : n === 7 ? [4, 3] : [4, 4];
}

/** The places of n clouds in the sky (x, y in % of the scene), a little uneven like real ones. */
export function cloudPlaces(n: number, tall = false): [number, number][] {
  const rows = cloudRows(n, tall);
  return rows.flatMap((k, row) =>
    Array.from({ length: k }, (_, i): [number, number] => [
      6 + ((i + 0.5) / k) * 88 + (row % 2 ? 2 : -2),
      rows.length === 1 ? 52 : 14 + ((row + 0.5) / rows.length) * 76 + (i % 2 ? 3 : -2),
    ]),
  );
}

const all = (n: number) => Array.from({ length: n }, (_, c) => c);

export const findCloudy: Generator<FindCloudySettings, FindCloudyRound> = {
  rounds: 3,
  make({ clouds: n, peek, every = 4, swaps = 0, jump = false }, rng) {
    const hide = int(rng, 0, n - 1);
    const moves: FindCloudyRound["moves"] = [];
    let cloudy = hide;
    // A third of the swaps (at least one) move Cloudy's own cloud, so the child has to follow it.
    const own = new Set(sample(rng, all(swaps), Math.max(swaps ? 1 : 0, Math.round(swaps / 3))));
    const jumpAt = jump ? int(rng, 1, Math.max(1, swaps - 1)) : -1;
    for (let k = 0; k < swaps; k++) {
      if (k === jumpAt) {
        cloudy = one(rng, all(n).filter((c) => c !== cloudy));
        moves.push({ jump: cloudy });
      }
      const a = own.has(k) ? cloudy : one(rng, all(n).filter((c) => c !== cloudy));
      const b = one(rng, all(n).filter((c) => c !== a && (own.has(k) || c !== cloudy)));
      moves.push({ swap: [a, b] });
    }
    return { clouds: n, peek, every, hide, moves };
  },
  key: (r) => `${r.hide}|${r.moves.map((m) => ("jump" in m ? `j${m.jump}` : m.swap.join("-"))).join(",")}`,
  // One cloud has Cloudy behind it at the end; every swap moves two different clouds and a jump goes to another one.
  answers: (r) => {
    let cloudy = r.hide;
    const ok = r.moves.every((m) => {
      if ("swap" in m) return m.swap[0] !== m.swap[1] && m.swap.every((c) => c >= 0 && c < r.clouds);
      const moved = m.jump !== cloudy && m.jump >= 0 && m.jump < r.clouds;
      cloudy = m.jump;
      return moved;
    });
    return [ok && r.hide >= 0 && r.hide < r.clouds ? 1 : 0];
  },
};

// ---------------------------------------------------------------- grow_cloudy
export interface GrowCloudySettings {
  drops: number;
  /** any: tap any drop · drops: only the drops, not the leaves · size: smallest to biggest · order: 1, 2, 3… */
  rule: "any" | "drops" | "size" | "order";
  /** Leaves among the drops (drops). */
  leaves?: number;
  /** Seconds the numbers show before they hide (order). */
  show?: number;
}
export interface GrowDrop {
  /** Where it floats: one of the 8 places above Cloudy. */
  cell: number;
  /** size: 1 (smallest) … drops · order: the number on it · any, drops: its turn does not matter (0). */
  rank: number;
}
export interface GrowCloudyRound {
  rule: GrowCloudySettings["rule"];
  drops: GrowDrop[];
  /** The places of the leaves. */
  leaves: number[];
  show: number;
}
/** The 8 places above Cloudy; the player lays them out for a wide or a tall sky. */
export const GROW_CELLS = 8;
/** The 4 growth stages of a session, and what Cloudy turns into after each (spec §6.2). */
export const GROW_FORMS = ["cloud", "bunny", "fox", "bear", "tiger"] as const;

export const growCloudy: Generator<GrowCloudySettings, GrowCloudyRound> = {
  rounds: 4,
  make({ drops: n, rule, leaves = 0, show = 3 }, rng) {
    const cells = sample(rng, all(GROW_CELLS), n + leaves);
    const ranks = rule === "size" || rule === "order" ? shuffled(rng, all(n).map((k) => k + 1)) : all(n).map(() => 0);
    return { rule, drops: cells.slice(0, n).map((cell, k) => ({ cell, rank: ranks[k] })), leaves: cells.slice(n), show };
  },
  key: (r) => `${r.drops.map((d) => `${d.cell}:${d.rank}`).join(",")}|${r.leaves.join(",")}`,
  // One right way through: every drop and leaf has a place of its own and, for size and order, the turns are 1…n.
  answers: (r) => {
    const places = [...r.drops.map((d) => d.cell), ...r.leaves];
    const ranks = r.drops.map((d) => d.rank).sort((a, b) => a - b);
    const turns = r.rule === "size" || r.rule === "order" ? ranks.every((x, k) => x === k + 1) : ranks.every((x) => x === 0);
    return [new Set(places).size === places.length && places.every((c) => c >= 0 && c < GROW_CELLS) && turns && r.drops.length > 0 ? 1 : 0];
  },
};
