"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { RoundOf, SkillKind } from "@/lib/games";

// Shared parts of the skill-game players (skill.tsx, skillAttention.tsx, skillMemory.tsx).

export type PlayerProps<K extends SkillKind> = {
  rounds: RoundOf<K>[];
  onDone: () => void;
};

/** Rounds one after another; `render` gets the round, its index and what to do next. */
export function Series<R>({ rounds, onDone, render }: { rounds: R[]; onDone: () => void; render: (r: R, index: number, next: () => void, last: boolean) => ReactNode }) {
  const [i, setI] = useState(0);
  const last = i + 1 >= rounds.length;
  return <>{render(rounds[i], i, () => (last ? onDone() : setI(i + 1)), last)}</>;
}

/** The size of the room a board has (a flex-1 box inside the Frame), kept up to date as the screen changes. */
export function useBox<E extends HTMLElement = HTMLDivElement>() {
  // A callback ref (kept in state), so the box is measured again if the element changes.
  const [el, setEl] = useState<E | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setBox({
        w: Math.floor(e.contentRect.width),
        h: Math.floor(e.contentRect.height),
      }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return { attach: setEl, ...box };
}

/**
 * The biggest square cell for `n` cards in a w×h room: tries every number of columns and keeps the one with the
 * largest cell (at most `max` px). Before the room is measured it gives `max`.
 */
export function bestGrid(n: number, w: number, h: number, max: number, gap = 8, maxCols = 8) {
  if (!w || !h) return { cols: Math.min(n, 4), size: max };
  let best = { cols: 1, size: 0 };
  for (let cols = 1; cols <= Math.min(n, maxCols); cols++) {
    const rows = Math.ceil(n / cols);
    const size = Math.min(max, (w - (cols - 1) * gap) / cols, (h - (rows - 1) * gap) / rows);
    if (size > best.size) best = { cols, size };
  }
  return { cols: best.cols, size: Math.floor(best.size) };
}
