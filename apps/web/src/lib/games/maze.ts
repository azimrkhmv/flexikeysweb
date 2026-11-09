import type { Rng } from "./rng";

// Mazes for the maze skill game: a "perfect" maze (exactly one way between any two cells) from a seed, plus a key and
// a door at the harder steps. Cells are numbered r * n + c; an open wall between two cells is the edge "a-b".

export const edge = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export function neighbors(n: number, c: number): number[] {
  const r = Math.floor(c / n);
  const k = c % n;
  return [r > 0 ? c - n : -1, r < n - 1 ? c + n : -1, k > 0 ? c - 1 : -1, k < n - 1 ? c + 1 : -1].filter((x) => x >= 0);
}

/** Randomized depth-first search: every cell reachable, one way through. */
export function perfectMaze(n: number, rng: Rng): string[] {
  const open: string[] = [];
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const next = neighbors(n, cur).filter((x) => !seen.has(x));
    if (!next.length) {
      stack.pop();
      continue;
    }
    const to = next[Math.floor(rng() * next.length)];
    open.push(edge(cur, to));
    seen.add(to);
    stack.push(to);
  }
  return open;
}

/** The cells from `from` to `to` (without `from`), going only through open edges and never through `closed`. */
export function route(n: number, open: ReadonlySet<string>, from: number, to: number, closed?: string): number[] | null {
  const prev = new Map([[from, from]]);
  const queue = [from];
  while (queue.length) {
    const c = queue.shift()!;
    if (c === to) break;
    for (const x of neighbors(n, c)) {
      const e = edge(c, x);
      if (open.has(e) && e !== closed && !prev.has(x)) {
        prev.set(x, c);
        queue.push(x);
      }
    }
  }
  if (!prev.has(to)) return null;
  const way: number[] = [];
  for (let c = to; c !== from; c = prev.get(c)!) way.unshift(c);
  return way;
}

/** A tree joining all n×n cells: exactly n² − 1 open edges and every cell reachable from the first. */
export function isPerfect(n: number, open: readonly string[]): boolean {
  if (new Set(open).size !== n * n - 1) return false;
  const set = new Set(open);
  for (let c = 1; c < n * n; c++) if (!route(n, set, 0, c)) return false;
  return true;
}
