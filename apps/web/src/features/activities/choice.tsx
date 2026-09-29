"use client";

import { useState, type ReactNode } from "react";
import { ItemArt } from "@/components/ItemArt";
import { VOCAB } from "@/content/vocab";
import { usePlay } from "@/features/play/context";
import type { SceneRound } from "@/lib/types";
import { ActionButton, answer, Frame, OptionCard, optionsFor, pick, shuffle, sizeFor, useActT, useClock, useHint } from "./kit";
import type { EngineProps } from "./registry";

// Archetype A (Prompt & Options) and D (Scene & Trigger): one answer among options.

export interface ChoiceSpec {
  answer: string;
  options: string[];
  prompt: string;
  speak?: [string, "learn" | "ui"][];
  stage?: ReactNode;
  /** Show the word (learning language) under each option. */
  labels?: boolean;
}

export function ChoiceEngine({ rounds, onDone, offset = 0, total }: { rounds: ChoiceSpec[]; onDone: () => void; offset?: number; total?: number }) {
  const [i, setI] = useState(0);
  return (
    <ChoiceRound
      key={i}
      spec={rounds[i]}
      index={offset + i}
      total={total ?? rounds.length}
      last={offset + i + 1 >= (total ?? rounds.length)}
      onNext={() => (i + 1 < rounds.length ? setI(i + 1) : onDone())}
    />
  );
}

function ChoiceRound({ spec, index, total, last, onNext }: { spec: ChoiceSpec; index: number; total: number; last: boolean; onNext: () => void }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const [solved, setSolved] = useState(false);
  const [tried, setTried] = useState<string[]>([]);
  const hint = useHint(() => ctx.say(spec.prompt, ctx.uiLang));
  const size = sizeFor(ctx, spec.stage ? 120 : 140);

  const choose = (id: string, info: Parameters<typeof answer>[1]["info"]) => {
    if (solved) return;
    const correct = id === spec.answer;
    answer(ctx, { target: spec.answer, actual: id, correct, latencyMs: clock.ms(), info });
    if (correct) setSolved(true);
    else {
      setTried((x) => [...x, id]);
      hint.miss();
    }
  };

  return (
    <Frame
      prompt={spec.prompt}
      speak={spec.speak}
      speakKey={`r${index}`}
      done={index + (solved ? 1 : 0)}
      total={total}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={onNext} pulse />}
    >
      {spec.stage}
      <div className="flex flex-wrap justify-center" style={{ gap: 12 + ctx.profile.spacing }}>
        {spec.options.map((id) => (
          <div key={id} className="flex flex-col items-center gap-2">
            <OptionCard
              label={VOCAB[id]?.word[ctx.learnLang] ?? id}
              size={size}
              onSelect={(info) => choose(id, info)}
              pulse={!solved && hint.show && id === spec.answer}
              state={solved && id === spec.answer ? "solved" : tried.includes(id) ? "tried" : undefined}
            >
              <ItemArt id={id} size={Math.round(size * 0.62)} />
            </OptionCard>
            {spec.labels && <span className="text-lg font-bold text-ink-2">{VOCAB[id]?.word[ctx.learnLang]}</span>}
          </div>
        ))}
      </div>
    </Frame>
  );
}

function PromptCard({ id }: { id: string }) {
  const ctx = usePlay();
  const s = sizeFor(ctx, 150);
  return (
    <div className="grid place-items-center rounded-fk-lg bg-surface-2 shadow-inner" style={{ width: s, height: s }}>
      <ItemArt id={id} size={Math.round(s * 0.66)} />
    </div>
  );
}

export function FindSame({ activity, onDone }: EngineProps<"find_same">) {
  const ctx = usePlay();
  const t = useActT();
  const [rounds] = useState(() =>
    pick(activity.items, 4).map((a): ChoiceSpec => ({ answer: a, options: optionsFor(a, activity.items, ctx.profile.optionCount), prompt: t("act.find_same"), stage: <PromptCard id={a} /> })),
  );
  return <ChoiceEngine rounds={rounds} onDone={onDone} />;
}

export function ListenPick({ activity, onDone }: EngineProps<"listen_pick">) {
  const ctx = usePlay();
  const t = useActT();
  const [rounds] = useState(() =>
    pick(activity.items, 4).map((a): ChoiceSpec => {
      const word = VOCAB[a].word[ctx.learnLang];
      return {
        answer: a,
        options: optionsFor(a, activity.items, ctx.profile.optionCount),
        prompt: t("act.listen_pick"),
        speak: [[t("act.listen_pick"), "ui"], [word, "learn"]],
        // Pre-readers rely on audio; the word is shown only as extra help.
        stage: ctx.profile.hintLevel >= 2 ? <span className="rounded-full bg-sun-soft px-6 py-2 text-2xl font-extrabold text-ink">{word}</span> : undefined,
      };
    }),
  );
  return <ChoiceEngine rounds={rounds} onDone={onDone} />;
}

export function Count({ activity, onDone }: EngineProps<"count">) {
  const ctx = usePlay();
  const t = useActT();
  const [rounds] = useState(() => {
    const pool = Array.from({ length: activity.max }, (_, k) => `n_${k + 1}`);
    return shuffle(pool)
      .slice(0, 4)
      .map((ans, r): ChoiceSpec => {
        const n = Number(ans.slice(2));
        const item = activity.items[r % activity.items.length];
        return {
          answer: ans,
          options: optionsFor(ans, pool, ctx.profile.optionCount).sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))),
          prompt: t("act.count"),
          stage: (
            <div className="flex max-w-xl flex-wrap justify-center gap-3 rounded-fk-lg bg-sun-soft/60 p-5">
              {Array.from({ length: n }, (_, k) => (
                <ItemArt key={k} id={item} size={sizeFor(ctx, 64)} />
              ))}
            </div>
          ),
        };
      });
  });
  return <ChoiceEngine rounds={rounds} onDone={onDone} />;
}

export function sceneSpec(r: SceneRound, lang: keyof SceneRound["prompt"], optionCount: number, size: number): ChoiceSpec {
  const others = r.options.filter((o) => o !== r.answer).slice(0, Math.max(1, optionCount - 1));
  return {
    answer: r.answer,
    options: shuffle([r.answer, ...others]),
    prompt: r.prompt[lang],
    labels: true,
    stage: <ScenePanel scene={r.scene} size={size} />,
  };
}

export function ScenePanel({ scene, size }: { scene: string; size: number }) {
  return (
    <div
      className="grid w-full max-w-2xl place-items-center rounded-fk-lg border border-line shadow-inner"
      style={{ minHeight: size, background: "linear-gradient(180deg,#e4effb 0%,#f4fbef 60%,#e1f1de 100%)" }}
      aria-hidden
    >
      <span className="leading-none tracking-widest" style={{ fontSize: size * 0.55 }}>
        {scene}
      </span>
    </div>
  );
}

export function Scene({ activity, onDone }: EngineProps<"scene">) {
  const ctx = usePlay();
  const [rounds] = useState(() => activity.rounds.map((r) => sceneSpec(r, ctx.uiLang, ctx.profile.optionCount, sizeFor(ctx, 200))));
  return <ChoiceEngine rounds={rounds} onDone={onDone} />;
}
