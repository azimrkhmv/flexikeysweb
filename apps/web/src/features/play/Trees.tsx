"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { sel, useDb } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Area } from "@/lib/skill";
import type { Child } from "@/lib/types";
import { usePlay } from "./context";
import { MapTabs, type MapTab } from "./WorldMap";

// "My trees" (games spec 8 Nov 2026 §8.5, B89): one tree per skill area. Its branches are the highest level the area
// ever reached ÷ 10, rounded down, so a tree never shrinks. No level yet (under 10 clean tries): a seed. A new branch
// grows with an animation and the child hears once "You got better at …!". No numbers anywhere (product rule 1).

const MAX_BRANCHES = 10;
export const branchesOf = (best: number | null) => (best === null ? null : Math.min(MAX_BRANCHES, Math.floor(best / 10)));

/** What this device last showed of each tree, so a new branch is announced once (this browser only). */
const seenKey = (childId: string) => `fk_trees_${childId}`;
function readSeen(childId: string): Partial<Record<Area, number>> | null {
  try {
    const raw = localStorage.getItem(seenKey(childId));
    return raw ? (JSON.parse(raw) as Partial<Record<Area, number>>) : null;
  } catch {
    return null;
  }
}

const GROW = { duration: 0.6, ease: "easeOut" } as const;

/** A seed in the ground, or a trunk with `n` branches and leaves; branches from `from` on grow in. */
function Tree({ n, from }: { n: number | null; from: number }) {
  if (n === null)
    return (
      <svg viewBox="0 0 100 100" className="h-24 w-24" aria-hidden>
        <ellipse cx={50} cy={86} rx={34} ry={7} fill="var(--fk-leaf-soft)" />
        <ellipse cx={50} cy={78} rx={9} ry={12} fill="#b98a5e" transform="rotate(-18 50 78)" />
        <path d="M51 67 q4 -9 11 -10" stroke="#5aa469" strokeWidth={3} fill="none" strokeLinecap="round" />
      </svg>
    );
  const top = 76 - 34 - n * 3.4; // the trunk grows a little with every branch
  const ys = Array.from({ length: n }, (_, k) => 70 - ((70 - top - 6) * (k + 0.5)) / n);
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24" aria-hidden>
      <ellipse cx={50} cy={86} rx={34} ry={7} fill="var(--fk-leaf-soft)" />
      <line x1={50} y1={84} x2={50} y2={top} stroke="#9b6b43" strokeWidth={6} strokeLinecap="round" />
      {ys.map((y, k) => {
        const side = k % 2 ? 1 : -1;
        const len = 26 - k * 1.2;
        const x2 = 50 + side * len;
        const y2 = y - 10;
        const fresh = k >= from;
        const delay = fresh ? 0.3 + (k - from) * 0.35 : 0;
        return (
          <g key={k}>
            <motion.line
              x1={50} y1={y} x2={x2} y2={y2} stroke="#9b6b43" strokeWidth={3.5} strokeLinecap="round"
              initial={fresh ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ ...GROW, delay }}
            />
            <motion.circle
              cx={x2} cy={y2} r={7} fill={k % 3 === 1 ? "#7cc47f" : "#5aa469"} style={{ transformBox: "fill-box", transformOrigin: "center" }}
              initial={fresh ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ ...GROW, delay: delay + 0.4 }}
            />
          </g>
        );
      })}
      <circle cx={50} cy={top - 4} r={11} fill="#5aa469" />
    </svg>
  );
}

export function Trees({ child, onTab }: { child: Child; onTab: (tab: MapTab) => void }) {
  const db = useDb();
  const t = useT(child.uiLang);
  const { say } = usePlay();
  const trees = sel.skillProgress(db, child.id).map((p) => ({ area: p.area, n: branchesOf(p.best) }));
  // Read once: what this device showed last time. None yet: every tree grows in, nothing is announced.
  const [seen] = useState(() => readSeen(child.id));
  const grown = seen ? trees.filter((tr) => (tr.n ?? 0) > (seen[tr.area] ?? 0)).map((tr) => t(`skill.area.${tr.area}`)) : [];
  const message = grown.length ? t("play.trees.better", { area: grown.join(", ") }) : null;
  const now = JSON.stringify(Object.fromEntries(trees.map((tr) => [tr.area, tr.n ?? 0])));

  useEffect(() => {
    try {
      localStorage.setItem(seenKey(child.id), now);
    } catch {
      // private mode or blocked storage: the trees still show, a branch may be announced again
    }
  }, [child.id, now]);
  const said = useRef(false);
  useEffect(() => {
    if (!message || said.current) return;
    said.current = true;
    say(message, child.uiLang);
  }, [message, say, child.uiLang]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="sr-only">{t("play.nav.trees")}</h1>
      <MapTabs child={child} tab="trees" onTab={onTab} />
      {message && (
        <motion.p
          role="status"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mb-4 max-w-xl rounded-fk-lg border-4 border-white bg-sun-soft px-4 py-3 text-center text-lg font-extrabold text-ink shadow-soft"
        >
          🌟 {message}
        </motion.p>
      )}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-4">
        {trees.map((tr) => (
          <li
            key={tr.area}
            className="flex min-w-0 flex-col items-center rounded-fk-lg border-2 border-white bg-surface/90 px-0.5 pb-2 pt-1 shadow-soft sm:border-4 sm:px-1"
            aria-label={t(tr.n === null ? "play.trees.seed" : "play.trees.tree", { area: t(`skill.area.${tr.area}`) })}
          >
            <Tree n={tr.n} from={seen ? Math.min(seen[tr.area] ?? 0, tr.n ?? 0) : 0} />
            <span className="w-full text-center text-[11px] font-extrabold leading-tight tracking-tight text-ink [overflow-wrap:anywhere] sm:text-sm sm:tracking-normal">{t(`skill.area.${tr.area}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
