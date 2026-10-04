"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ItemArt } from "@/components/ItemArt";
import { VOCAB } from "@/content/vocab";
import { sfx } from "@/lib/audio";
import { usePlay } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";
import { ChoiceEngine, type ChoiceSpec } from "./choice";
import { ActionButton, answer, Frame, OptionCard, pick, shuffle, sizeFor, useActT, useClock, useHint, WatchAgain } from "./kit";
import type { EngineProps } from "./registry";

// Archetype B (Stage & Replay): watch something, then repeat or recall it.

const STEP_MS = 1000;
const STEP_MS_CVI = 2000; // children with CVI often need seconds before they look

/** Watch → repeat state machine shared by `sequence` and `light_path`. No time limit to answer. */
function useSequence(seq: string[], onSolved: () => void) {
  const ctx = usePlay();
  const clock = useClock();
  const [phase, setPhase] = useState<"watch" | "repeat" | "solved">("watch");
  const [lit, setLit] = useState(-1);
  const [pos, setPos] = useState(0);
  const [run, setRun] = useState(0);
  const hint = useHint();

  const step = ctx.support?.cvi ? STEP_MS_CVI : STEP_MS;
  useEffect(() => {
    if (phase !== "watch") return;
    const timers = seq.map((_, k) =>
      setTimeout(() => {
        setLit(k);
        sfx("pop");
      }, 900 + k * step),
    );
    timers.push(
      setTimeout(() => {
        setLit(-1);
        setPhase("repeat");
        clock.reset();
      }, 900 + seq.length * step),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- replay is driven by `run`
  }, [phase, run, seq, step]);

  return {
    phase,
    lit,
    pos,
    replay() {
      if (phase === "solved") return;
      setPhase("watch");
      setRun((r) => r + 1);
    },
    tap(id: string, info: SelectInfo) {
      if (phase !== "repeat") return;
      const expected = seq[pos];
      const correct = id === expected;
      const finished = correct && pos + 1 === seq.length;
      answer(ctx, { target: expected, actual: id, correct, latencyMs: clock.ms(), info, quiet: !finished });
      if (!correct) return hint.miss();
      clock.reset();
      setPos(pos + 1);
      if (finished) {
        setPhase("solved");
        onSolved();
      }
    },
    hintId: hint.show && phase === "repeat" ? seq[pos] : null,
  };
}

function Rounds<T>({ make, count, render, onDone }: { make: () => T; count: number; render: (spec: T, i: number, next: () => void, last: boolean) => ReactNode; onDone: () => void }) {
  const [specs] = useState(() => Array.from({ length: count }, make));
  const [i, setI] = useState(0);
  const last = i + 1 >= count;
  return <>{render(specs[i], i, () => (last ? onDone() : setI(i + 1)), last)}</>;
}

// ---------------------------------------------------------------- sequence
export function Sequence({ activity, onDone }: EngineProps<"sequence">) {
  return (
    <Rounds
      count={3}
      make={() => pick(activity.items, Math.min(activity.length, activity.items.length))}
      onDone={onDone}
      render={(seq, i, next, last) => <SequenceRound key={i} seq={seq} options={activity.items} index={i} next={next} last={last} />}
    />
  );
}

function SequenceRound({ seq, options, index, next, last }: { seq: string[]; options: string[]; index: number; next: () => void; last: boolean }) {
  const ctx = usePlay();
  const t = useActT();
  const [solved, setSolved] = useState(false);
  const s = useSequence(seq, () => setSolved(true));
  const size = sizeFor(ctx, 104);
  const slot = Math.max(64, Math.round(size * 0.72));
  const watching = s.phase === "watch";

  return (
    <Frame
      prompt={t(watching ? "act.sequence.watch" : "act.sequence.repeat")}
      speakKey={`r${index}`}
      done={index + (solved ? 1 : 0)}
      total={3}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      <div className="flex gap-3 rounded-fk-lg bg-surface-2 p-4 shadow-inner" aria-live="polite">
        {seq.map((id, k) => {
          const show = watching ? s.lit === k : k < s.pos;
          return (
            <span
              key={k}
              className={`grid place-items-center rounded-2xl transition-all duration-300 ${show ? "scale-110 bg-surface shadow-lift" : "bg-line/40"}`}
              style={{ width: slot, height: slot }}
            >
              {show && <ItemArt id={id} size={Math.round(slot * 0.7)} />}
            </span>
          );
        })}
      </div>
      <WatchAgain onSelect={s.replay} disabled={watching || solved} />
      <div className="flex flex-wrap justify-center rounded-fk-lg bg-surface-2 p-4" style={{ gap: 12 + ctx.profile.spacing }}>
        {options.map((id) => (
          <OptionCard key={id} label={VOCAB[id]?.word[ctx.learnLang] ?? id} size={size} disabled={watching || solved} onSelect={(info) => s.tap(id, info)} pulse={s.hintId === id}>
            <ItemArt id={id} size={Math.round(size * 0.62)} />
          </OptionCard>
        ))}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- light path (design game 11)
const STARS: [number, number][] = [
  [12, 62], [28, 30], [44, 70], [58, 36], [74, 64], [88, 28],
];

export function LightPath({ activity, onDone }: EngineProps<"light_path">) {
  return (
    <Rounds
      count={3}
      make={() => pick(STARS.map((_, k) => `star${k}`), Math.min(activity.length, STARS.length))}
      onDone={onDone}
      render={(seq, i, next, last) => <LightRound key={i} seq={seq} index={i} next={next} last={last} />}
    />
  );
}

function LightRound({ seq, index, next, last }: { seq: string[]; index: number; next: () => void; last: boolean }) {
  const ctx = usePlay();
  const t = useActT();
  const [solved, setSolved] = useState(false);
  const s = useSequence(seq, () => setSolved(true));
  const size = sizeFor(ctx, 84);
  const watching = s.phase === "watch";
  const at = (id: string) => STARS[Number(id.slice(4))];
  const done = seq.slice(0, watching ? 0 : s.pos);

  return (
    <Frame
      prompt={t(watching ? "act.light_path.watch" : "act.light_path.repeat")}
      speakKey={`r${index}`}
      done={index + (solved ? 1 : 0)}
      total={3}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      <div className="relative aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-fk-lg shadow-inner" style={{ background: "linear-gradient(180deg,#34497a 0%,#4a5f93 60%,#62709e 100%)" }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          <polyline points={done.map((id) => at(id).join(",")).join(" ")} fill="none" stroke="#f5d272" strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.8" />
        </svg>
        {STARS.map(([x, y], k) => {
          const id = `star${k}`;
          const on = (watching && seq[s.lit] === id) || done.includes(id);
          return (
            <Target
              key={id}
              label={t("act.star", { n: k + 1 })}
              disabled={watching || solved}
              onSelect={(info) => s.tap(id, info)}
              pulse={s.hintId === id}
              className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full disabled:opacity-100"
              style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
            >
              <span
                className={`block rounded-full transition-all duration-300 ${on ? "fk-glow bg-sun" : "bg-[#8d9cc4]"}`}
                style={{ width: size * (on ? 0.55 : 0.32), height: size * (on ? 0.55 : 0.32), boxShadow: on ? "0 0 30px 10px rgb(245 210 114 / .55)" : undefined }}
              />
            </Target>
          );
        })}
      </div>
      <WatchAgain onSelect={s.replay} disabled={watching || solved} />
    </Frame>
  );
}

// ---------------------------------------------------------------- what's missing (design game 12)
export function Missing({ activity, onDone }: EngineProps<"missing">) {
  return (
    <Rounds
      count={3}
      make={() => {
        const shown = pick(activity.items, Math.min(4, activity.items.length));
        return { shown, gone: shown[Math.floor(Math.random() * shown.length)] };
      }}
      onDone={onDone}
      render={(spec, i, next) => <MissingRound key={i} {...spec} pool={activity.items} index={i} next={next} />}
    />
  );
}

function MissingRound({ shown, gone, pool, index, next }: { shown: string[]; gone: string; pool: string[]; index: number; next: () => void }) {
  const ctx = usePlay();
  const t = useActT();
  const [looking, setLooking] = useState(true);
  const [spec] = useState<ChoiceSpec>(() => {
    const n = Math.max(2, Math.min(ctx.profile.optionCount, pool.length));
    const others = pick(pool, n - 1, [gone, ...shown]);
    const fill = pick(shown, n - 1 - others.length, [gone]);
    return { answer: gone, options: shuffle([gone, ...others, ...fill]), prompt: t("act.missing") };
  });
  const size = sizeFor(ctx, 96);
  const row = (hide: boolean) => (
    <div className="flex flex-wrap justify-center gap-3 rounded-fk-lg bg-surface-2 p-4 shadow-inner">
      {shown.map((id) => (
        <span key={id} className="grid place-items-center rounded-2xl bg-surface shadow-soft" style={{ width: size, height: size }}>
          {hide && id === gone ? <span className="text-5xl font-extrabold text-muted">?</span> : <ItemArt id={id} size={Math.round(size * 0.66)} />}
        </span>
      ))}
    </div>
  );

  if (looking)
    return (
      <Frame
        prompt={t("act.missing.look")}
        speakKey={`look${index}`}
        done={index}
        total={3}
        action={<ActionButton label={t("act.ready")} onSelect={() => setLooking(false)} />}
      >
        {row(false)}
      </Frame>
    );
  return <ChoiceEngine rounds={[{ ...spec, stage: row(true) }]} onDone={next} offset={index} total={3} />;
}
