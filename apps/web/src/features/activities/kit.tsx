"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Volume2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { usePlay, type PlayCtx } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";
import { Correct, Enter, RoundDone } from "./anim";

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

/** `setTimeout` that is cancelled when the component unmounts (no speech after the child has left a round). */
export function useLater() {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const set = timers.current;
    return () => set.forEach(clearTimeout);
  }, []);
  return (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  };
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

/** Mistakes before the right answer pulses, and before the other answers fade (5 Oct brief, games spec §1). */
export const PULSE_AFTER = 2;
export const FADE_AFTER = 4;

/**
 * Hint state per round (5 Oct brief): after 2 mistakes the right answer gently pulses, after 4 the others fade, so
 * every round ends in success. A child who needs more help (hint level 3) gets the pulse after the first mistake,
 * and from level 2 also after an idle wait; level 3 also re-speaks the prompt after a miss. Remount (key) per round
 * to reset, or call `reset()` when one board moves on to its next item.
 */
export function useHint(onRespeak?: () => void) {
  const ctx = usePlay();
  const [misses, setMisses] = useState(0);
  const [idle, setIdle] = useState(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (ctx.profile.hintLevel < 2) return;
    // ponytail: fixed waits; children with CP often need 3–10 s to start a movement, and scanning needs a full
    // cycle. Upgrade path: scale with the child's own median latency once the profile carries it.
    const id = setTimeout(() => setIdle(true), ctx.access === "touch" ? 4000 : 8000);
    return () => clearTimeout(id);
  }, [ctx.profile.hintLevel, ctx.access, run]);
  const show = misses >= (ctx.profile.hintLevel >= 3 ? 1 : PULSE_AFTER) || idle;
  const fade = misses >= FADE_AFTER;
  // The try records the strongest hint shown: "shimmer" (the pulse), then "fade".
  const told = useRef(0);
  const level = fade ? 2 : show ? 1 : 0;
  useEffect(() => {
    for (; told.current < level; told.current++) ctx.emit({ type: "hint_shown", levelId: ctx.levelId, activityId: ctx.activityId });
  }, [level, ctx]);
  return {
    show,
    fade,
    misses,
    miss() {
      setMisses((m) => m + 1);
      if (ctx.profile.hintLevel >= 3) onRespeak?.();
    },
    reset() {
      setMisses(0);
      setIdle(false);
      told.current = 0;
      setRun((r) => r + 1);
    },
  };
}

/** Emit a select/key event with the shared fields filled in. */
export function answer(ctx: PlayCtx, e: { target: string; actual: string; correct?: boolean; latencyMs: number; info?: SelectInfo; type?: "select" | "key"; quiet?: boolean }) {
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
  // `correct` undefined = a step that cannot fail (tracing): no accuracy/BKT evidence, reacts as success.
  const ok = e.correct ?? true;
  if (!(e.quiet && ok)) ctx.react(ok ? "success" : "try");
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

/** "Watch again" for Stage & Replay games — a full-size child target, reachable by switch scanning. */
export function WatchAgain({ onSelect, disabled }: { onSelect: () => void; disabled?: boolean }) {
  const t = useActT();
  return (
    <Target label={t("act.watch_again")} onSelect={onSelect} disabled={disabled} className="rounded-full bg-sky-soft px-8 text-lg font-extrabold text-ink shadow-soft disabled:opacity-40">
      🔁 {t("act.watch_again")}
    </Target>
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
    // One utterance per language; the learn-language words are queued so a long instruction is never cut off.
    const ui = lines.filter(([, l]) => l === "ui").map(([s]) => s).join(". ");
    const learn = lines.filter(([, l]) => l === "learn").map(([s]) => s).join(". ");
    if (ui) ctx.say(ui, ctx.uiLang);
    if (learn) ctx.say(learn, ctx.learnLang, !!ui);
  };
  const key = `${speakKey ?? ""}|${lines.map((l) => l[0]).join("|")}`;
  const said = useRef("");
  useEffect(() => {
    if (said.current === key) return;
    said.current = key;
    sayAll();
  });
  // Round done (B81): stars float up whenever the progress dots move on.
  const [stars, setStars] = useState({ done, at: 0 });
  if (done !== stars.done) setStars({ done, at: done > stars.done ? stars.at + 1 : stars.at });

  return (
    // On a short, wide screen (`short`, B66) the prompt sits beside the speaker button and the action button floats
    // over the bottom corner instead of keeping an empty row, so the whole game fits without scrolling.
    <section className="relative flex h-full min-h-[480px] w-full flex-col rounded-fk-lg border border-line bg-surface p-4 shadow-soft sm:p-6 short:min-h-0 short:p-3">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4">
        <span className="w-[76px] short:row-span-2" />
        <div className="flex justify-center"><Dots total={total} done={done} /></div>
        <Target label={t("act.replay")} onSelect={sayAll} className="grid place-items-center rounded-full bg-sky-soft text-ink transition hover:bg-[#d6e6f8] short:row-span-2">
          <Volume2 className="size-8" aria-hidden />
        </Target>
        <h2 className="col-span-3 mt-3 text-center text-2xl font-extrabold text-ink sm:text-3xl short:col-span-1 short:col-start-2 short:mt-1 short:text-2xl">{prompt}</h2>
      </div>
      {/* Enter (B81): the round's cards and options slide in one after another. */}
      <Enter className="flex flex-1 flex-col items-center justify-center gap-6 py-4 short:gap-3 short:py-2">
        {children}
      </Enter>
      <div className="flex min-h-[84px] items-center justify-end short:pointer-events-none short:absolute short:bottom-3 short:right-3 short:min-h-0 short:[&>*]:pointer-events-auto">{action}</div>
      {stars.at > 0 && <RoundDone key={stars.at} />}
    </section>
  );
}

/**
 * Soft card that holds an option picture. `state` drives the calm selected/solved looks — never red. `faded`: after
 * 4 mistakes the other answers fade and rest, so the right one is all that is left to choose (and to scan).
 */
export function OptionCard({
  label,
  size,
  onSelect,
  pulse,
  state,
  children,
  disabled,
  faded,
  height,
}: {
  label: string;
  size: number;
  onSelect: (info: SelectInfo) => void;
  pulse?: boolean;
  state?: "solved" | "tried";
  children: ReactNode;
  disabled?: boolean;
  faded?: boolean;
  /** A wide card (a word, a number line mark): its height; `size` is then the width. */
  height?: number;
}) {
  return (
    <Target
      label={label}
      onSelect={onSelect}
      pulse={pulse}
      disabled={disabled || faded}
      scanSkip={faded}
      selected={state === "solved"}
      className={`grid place-items-center rounded-fk-lg border-4 bg-surface-2 shadow-soft transition ${
        state === "solved" ? "border-teal bg-teal-soft" : faded ? "border-transparent opacity-25" : state === "tried" ? "border-transparent opacity-70" : "border-transparent hover:bg-sky-soft"
      }`}
      style={{ width: size, height: height ?? size }}
    >
      <Correct on={state === "solved"}>{children}</Correct>
    </Target>
  );
}
