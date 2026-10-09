"use client";

import { useState } from "react";
import { usePlay } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";
import { ChoiceEngine, PromptCard, type ChoiceSpec } from "./choice";
import { answer, Frame, optionsFor, pick, sizeFor, useActT, useClock, useLater } from "./kit";

// Warm-up (access skills, the "level 0" of eye-gaze and switch curricula): cause and effect → one big target →
// a smaller target that moves → choosing between two. It sits outside the 16 levels: no level id, no rewards,
// nothing to unlock — only presses for the adaptive engine. Children with severe motor or vision difficulties
// start each session here.

const STAGES = 4;
const HITS = 3;
const SPOTS = ["self-start", "self-center", "self-end"] as const;
const PICTURES = ["apple", "cat", "dog", "banana", "ball", "fish"];

export function WarmUp({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState(0);
  const next = () => (stage + 1 < STAGES ? setStage(stage + 1) : onDone());
  if (stage === 3) return <Choose onDone={next} />;
  return <Press key={stage} stage={stage} onDone={next} />;
}

/** Stages 0–2: press anywhere (cause and effect), press the big star, press the star wherever it goes. */
function Press({ stage, onDone }: { stage: number; onDone: () => void }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const later = useLater();
  const [hits, setHits] = useState(0);
  const [spot, setSpot] = useState(1);
  const size = stage === 1 ? sizeFor(ctx, 220) : sizeFor(ctx, 120);

  const hit = (info: SelectInfo) => {
    if (hits >= HITS) return;
    const n = hits + 1;
    // Cause and effect can't be missed: no `correct`. A star hit is a real targeting success.
    answer(ctx, { target: "star", actual: "star", correct: stage === 0 ? undefined : true, latencyMs: clock.ms(), info });
    clock.reset();
    setHits(n);
    if (stage === 2) setSpot((s) => (s + 1 + Math.floor(Math.random() * 2)) % SPOTS.length);
    if (n >= HITS) later(onDone, 1200); // advance by itself: no extra button to reach
  };

  const prompt = t(stage === 0 ? "warm.anywhere" : "warm.star");
  return (
    <Frame prompt={prompt} speakKey={`w${stage}`} done={stage} total={STAGES}>
      {stage === 0 ? (
        <Target label={prompt} onSelect={hit} className="grid min-h-72 w-full place-items-center rounded-fk-lg bg-sky-soft text-[8rem] leading-none">
          <span aria-hidden className={hits ? "fk-pop" : ""} key={hits}>
            {["☁️", "🌈", "🎈", "⭐"][hits]}
          </span>
        </Target>
      ) : (
        <div className={`flex w-full flex-col ${stage === 2 ? "min-h-72" : ""}`}>
          <Target
            label={t("warm.starLabel")}
            onSelect={hit}
            pulse={ctx.profile.hintLevel >= 1}
            className={`${stage === 2 ? SPOTS[spot] : "self-center"} grid place-items-center rounded-full bg-sun-soft shadow-soft`}
            style={{ width: size, height: size, fontSize: size * 0.55 }}
          >
            <span aria-hidden key={hits} className={hits ? "fk-pop" : ""}>
              ⭐
            </span>
          </Target>
        </div>
      )}
    </Frame>
  );
}

/** Stage 3: the same picture, out of two. */
function Choose({ onDone }: { onDone: () => void }) {
  const t = useActT();
  const [rounds] = useState(() =>
    pick(PICTURES, HITS).map((a): ChoiceSpec => ({ answer: a, options: optionsFor(a, PICTURES, 2), prompt: t("act.find_same"), stage: <PromptCard id={a} /> })),
  );
  return <ChoiceEngine rounds={rounds} onDone={onDone} />;
}
