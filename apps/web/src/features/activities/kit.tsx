"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Volume2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { usePlay, type PlayCtx } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";

// Shared building blocks for every activity engine: frame, hints, telemetry helpers.

export function shuffle<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** `n` random picks from `xs` excluding `not`. */
export const pick = <T,>(xs: readonly T[], n: number, not: readonly T[] = []) => shuffle(xs.filter((x) => !not.includes(x))).slice(0, n);

/** Options for Prompt & Options engines: answer + distractors, count = profile.optionCount (min 2). */
export function optionsFor(answer: string, pool: readonly string[], optionCount: number) {
  const n = Math.max(2, Math.min(optionCount, pool.length));
  return shuffle([answer, ...pick(pool, n - 1, [answer])]);
}

/** Base target size (px) scaled by the adaptive profile; never under 76. */
export const sizeFor = (ctx: PlayCtx, base = 132) => Math.max(76, Math.round(base * ctx.profile.targetScale));

export function useActT() {
  return useT(usePlay().uiLang);
}

/** Latency clock for the current round: call `reset()` when a round is shown, `ms()` on an answer. */
export function useClock() {
  const t0 = useRef(0);
  useEffect(() => {
    t0.current = performance.now();
  }, []);
  return {
    reset: () => void (t0.current = performance.now()),
    ms: () => Math.round(performance.now() - t0.current),
  };
}

/**
 * Hint state per round (PRD §9.4 hint levels): after a miss (level ≥1), after 2 s idle (level ≥2);
 * level 3 also re-speaks the prompt after a miss. Remount (key) per round to reset.
 */
export function useHint(onRespeak?: () => void) {
  const ctx = usePlay();
  const [missed, setMissed] = useState(false);
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (ctx.profile.hintLevel < 2) return;
    const id = setTimeout(() => setIdle(true), 2000);
    return () => clearTimeout(id);
  }, [ctx.profile.hintLevel]);
  return {
    show: (missed && ctx.profile.hintLevel >= 1) || idle,
    miss() {
      setMissed(true);
      if (ctx.profile.hintLevel >= 3) onRespeak?.();
    },
  };
}

/** Emit a select/key event with the shared fields filled in. */
export function answer(ctx: PlayCtx, e: { target: string; actual: string; correct: boolean; latencyMs: number; info?: SelectInfo; type?: "select" | "key"; quiet?: boolean }) {
  ctx.emit({
    type: e.type ?? "select",
    levelId: ctx.levelId,
    activityId: ctx.activityId,
    target: e.target,
    actual: e.actual,
    correct: e.correct,
    latencyMs: e.latencyMs,
    offsetRatio: e.info?.offsetRatio,
    pointerType: e.info?.pointerType,
  });
  // `quiet`: intermediate correct steps (e.g. one letter of a word) don't trigger praise.
  if (!(e.quiet && e.correct)) ctx.react(e.correct ? "success" : "try");
}

export function Dots({ total, done }: { total: number; done: number }) {
  const t = useActT();
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={t("act.progress", { n: done, total })}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`rounded-full transition-all ${i < done ? "size-3 bg-teal" : i === done ? "size-4 bg-sky ring-4 ring-sky-soft" : "size-3 bg-line"}`}
        />
      ))}
    </div>
  );
}

export function ActionButton({ label, onSelect, pulse }: { label: string; onSelect: () => void; pulse?: boolean }) {
  return (
    <Target label={label} onSelect={onSelect} pulse={pulse} className="fk-pop rounded-full bg-sky-soft px-10 text-xl font-extrabold text-ink shadow-soft hover:bg-[#d6e6f8]">
      {label}
    </Target>
  );
}

/**
 * The white rounded card every engine lives in (design archetypes A–E):
 * progress dots + replay on top, prompt, stage, action button bottom-right.
 * Speaks `speak` (defaults to the prompt) whenever `speakKey` changes — pass the round index in it.
 */
export function Frame({
  prompt,
  speak,
  speakKey,
  done,
  total,
  children,
  action,
}: {
  prompt: string;
  speak?: [string, "learn" | "ui"][];
  speakKey?: string;
  done: number;
  total: number;
  children: ReactNode;
  action?: ReactNode;
}) {
  const ctx = usePlay();
  const t = useActT();
  const lines = speak ?? [[prompt, "ui"] as [string, "ui"]];
  const sayAll = () => {
    // ponytail: one utterance per language; learn-language words follow the instruction after a short pause.
    const ui = lines.filter(([, l]) => l === "ui").map(([s]) => s).join(". ");
    const learn = lines.filter(([, l]) => l === "learn").map(([s]) => s).join(". ");
    if (ui) ctx.say(ui, ctx.uiLang);
    if (learn) setTimeout(() => ctx.say(learn, ctx.learnLang), ui ? 1600 : 0);
  };
  const key = `${speakKey ?? ""}|${lines.map((l) => l[0]).join("|")}`;
  const said = useRef("");
  useEffect(() => {
    if (said.current === key) return;
    said.current = key;
    sayAll();
  });

  return (
    <section className="flex h-full min-h-[480px] w-full flex-col rounded-fk-lg border border-line bg-surface p-4 shadow-soft sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <span className="w-12" />
        <Dots total={total} done={done} />
        <button
          type="button"
          onClick={sayAll}
          aria-label={t("act.replay")}
          title={t("act.replay")}
          className="grid size-12 place-items-center rounded-full bg-sky-soft text-ink transition hover:bg-[#d6e6f8]"
        >
          <Volume2 className="size-6" aria-hidden />
        </button>
      </div>
      <h2 className="mt-3 text-center text-2xl font-extrabold text-ink sm:text-3xl">{prompt}</h2>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4">{children}</div>
      <div className="flex min-h-[84px] items-center justify-end">{action}</div>
    </section>
  );
}

/** Soft card that holds an option picture. `state` drives the calm selected/solved looks — never red. */
export function OptionCard({
  label,
  size,
  onSelect,
  pulse,
  state,
  children,
  disabled,
}: {
  label: string;
  size: number;
  onSelect: (info: SelectInfo) => void;
  pulse?: boolean;
  state?: "solved" | "tried";
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Target
      label={label}
      onSelect={onSelect}
      pulse={pulse}
      disabled={disabled}
      selected={state === "solved"}
      className={`grid place-items-center rounded-fk-lg border-4 bg-surface-2 shadow-soft transition ${
        state === "solved" ? "border-teal bg-teal-soft" : state === "tried" ? "border-transparent opacity-70" : "border-transparent hover:bg-sky-soft"
      }`}
      style={{ width: size, height: size }}
    >
      {children}
    </Target>
  );
}
