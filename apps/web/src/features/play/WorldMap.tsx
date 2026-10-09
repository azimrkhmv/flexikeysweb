"use client";

import { useEffect, useRef } from "react";
import { Mascot } from "@/components/Mascot";
import { LEVELS, LEVEL_BY_ID } from "@/content/levels";
import { sel, useDb } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { ActivityKind, Child, Level } from "@/lib/types";
import { Target } from "./Target";
import { usePlay } from "./context";

const STEP = 136; // vertical distance between level nodes (px)
const NODE = 104;
const xOf = (i: number) => 50 + 30 * Math.sin(i * 0.85); // % across the map

const TONE: Record<Level["color"], string> = {
  sky: "var(--fk-sky-soft)",
  leaf: "var(--fk-leaf-soft)",
  sun: "var(--fk-sun-soft)",
  lavender: "var(--fk-lavender-soft)",
  teal: "var(--fk-teal-soft)",
  peach: "var(--fk-peach-soft)",
};

export const KIND_EMOJI: Record<ActivityKind, string> = {
  find_same: "🔍", listen_pick: "👂", count: "🔢", sort: "🧺", sequence: "🔁", missing: "❓", light_path: "✨",
  path: "〰️", scene: "🌱", puzzle: "🧩", type: "⌨️", sentence: "💬", story: "📖",
  trace: "✏️", dots: "🔵", color: "🖍️", maze: "🌀", paint: "🎨",
};

/** World map: 16 levels on a winding path. Locked levels are sleeping clouds, never padlocks. */
export function WorldMap({ child, onOpen }: { child: Child; onOpen: (levelId: string) => void }) {
  const db = useDb();
  const t = useT(child.uiLang);
  const { profile } = usePlay();
  const focusRef = useRef<HTMLDivElement>(null);
  const states = LEVELS.map((_, i) => sel.levelState(db, child.id, i));
  const firstOpen = states.indexOf("open");
  const tasks = sel.assignmentsFor(db, child.id).filter((a) => LEVEL_BY_ID[a.levelId] && states[LEVEL_BY_ID[a.levelId].n - 1] !== "done");
  const taskLevels = [...new Set(tasks.map((a) => a.levelId))];
  const size = Math.round(NODE * profile.targetScale);

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  const pts = LEVELS.map((_, i) => [xOf(i), 70 + i * STEP] as const);
  const d = pts.map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `C${pts[i - 1][0]} ${pts[i - 1][1] + STEP / 2} ${x} ${y - STEP / 2} ${x} ${y}`)).join(" ");
  const height = 70 + LEVELS.length * STEP;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="mb-4 text-center text-3xl font-extrabold text-ink">{t("play.map.title")}</h1>

      {taskLevels.length > 0 && (
        <section className="mb-6 flex flex-wrap items-center gap-4 rounded-fk-lg border border-line bg-surface/90 p-4 shadow-soft">
          <Mascot mood="happy" size={72} float={false} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold text-ink">{t("play.tasks.title")}</p>
            <p className="text-ink-2">
              {t(`play.tasks.from.${tasks[0].kind}`)} · {t("play.tasks.count", { n: taskLevels.length })}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {taskLevels.map((id) => {
              // A task points the way but never opens a sleeping level (FR-CUR-4): tapping it gets the same
              // gentle "still sleeping" answer as the map.
              const state = states[LEVEL_BY_ID[id].n - 1];
              const asleep = state === "sleeping" || state === "plan";
              return (
                <Target
                  key={id}
                  label={LEVEL_BY_ID[id].title[child.uiLang]}
                  onSelect={() => onOpen(id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-3xl px-4 font-bold text-ink shadow-soft ${asleep ? "bg-[#eef2f8]" : "bg-sun-soft"}`}
                >
                  {asleep ? <Mascot mood="sleepy" size={44} float={false} label="" /> : <span className="text-3xl">{LEVEL_BY_ID[id].emoji}</span>}
                  <span className="text-sm">{LEVEL_BY_ID[id].title[child.uiLang]}</span>
                </Target>
              );
            })}
          </div>
        </section>
      )}

      <div className="relative" style={{ height }}>
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
          <path d={d} fill="none" stroke="#ffffff" strokeWidth="14" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.9" />
          <path d={d} fill="none" stroke="#c9d9ef" strokeWidth="4" strokeDasharray="2 14" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {LEVELS.map((level, i) => {
          const state = states[i];
          const asleep = state === "sleeping" || state === "plan";
          const stars = sel.levelProgress(db, child.id, level.id).stars;
          return (
            <div
              key={level.id}
              ref={i === firstOpen ? focusRef : undefined}
              className="absolute flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${pts[i][0]}%`, top: pts[i][1] - size / 2 }}
            >
              <Target
                label={level.title[child.uiLang]}
                onSelect={() => onOpen(level.id)}
                scanSkip={asleep}
                pulse={state === "open" && profile.hintLevel >= 2}
                className={`grid place-items-center rounded-full border-4 shadow-lift transition ${asleep ? "border-white/70 bg-[#eef2f8]" : "border-white"}`}
                style={{ width: size, height: size, background: asleep ? undefined : TONE[level.color] }}
              >
                {asleep ? (
                  <Mascot mood="sleepy" size={size * 0.72} float={false} label="" />
                ) : (
                  <span className={`leading-none ${state === "open" ? "fk-glow" : ""}`} style={{ fontSize: size * 0.46 }}>
                    {level.emoji}
                  </span>
                )}
                {state === "done" && <span className="absolute -right-1 -top-1 grid size-9 place-items-center rounded-full bg-sun text-lg shadow-soft">⭐</span>}
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-surface px-2 text-xs font-extrabold text-ink-2 shadow-soft">{level.n}</span>
              </Target>
              <span className={`mt-3 max-w-36 rounded-full px-3 py-0.5 text-center text-sm font-extrabold ${asleep ? "text-muted" : "bg-surface/90 text-ink"}`}>
                {level.title[child.uiLang]}
                {stars > 0 && <span className="ml-1 text-xs text-[#7a5a0c]">⭐{stars}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One level: its activities as big cards. */
export function LevelView({ child, levelId, onPlay }: { child: Child; levelId: string; onPlay: (activityId: string) => void }) {
  const db = useDb();
  const t = useT(child.uiLang);
  const level = LEVEL_BY_ID[levelId];
  const done = sel.levelProgress(db, child.id, levelId).completed;
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex items-center justify-center gap-3">
        <span className="text-5xl">{level.emoji}</span>
        <h1 className="text-3xl font-extrabold text-ink">{level.title[child.uiLang]}</h1>
      </div>
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
        {level.activities.map((a) => (
          <Target
            key={a.id}
            label={t(`play.kind.${a.kind}`)}
            onSelect={() => onPlay(a.id)}
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-fk-lg border-4 border-white p-4 font-extrabold text-ink shadow-soft"
            style={{ background: TONE[level.color] }}
          >
            <span className="text-5xl">{KIND_EMOJI[a.kind]}</span>
            <span className="text-lg">{t(`play.kind.${a.kind}`)}</span>
            {done.includes(a.id) && <span className="absolute right-3 top-3 text-2xl">⭐</span>}
          </Target>
        ))}
      </div>
    </div>
  );
}
