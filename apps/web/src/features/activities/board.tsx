"use client";

import { useState } from "react";
import { ItemArt } from "@/components/ItemArt";
import { VOCAB } from "@/content/vocab";
import { usePlay } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";
import { ChoiceEngine, ScenePanel, sceneSpec } from "./choice";
import { ActionButton, answer, Frame, shuffle, sizeFor, useActT, useClock, useHint } from "./kit";
import type { EngineProps } from "./registry";

// Archetype E (Board & Pieces) + word/story builders. Everything is tap-then-tap: no dragging.

// ---------------------------------------------------------------- sort (design game 15)
export function Sort({ activity, onDone }: EngineProps<"sort">) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const [items] = useState(() => shuffle(activity.groups.flatMap((g, gi) => g.items.map((id) => ({ id, gi })))));
  const [placed, setPlaced] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [missedOn, setMissedOn] = useState<string | null>(null);
  const left = items.filter((x) => !(x.id in placed));
  const current = left.find((x) => x.id === picked) ?? left[0];
  const size = sizeFor(ctx, 104);

  const drop = (gi: number, info: SelectInfo) => {
    if (!current) return;
    const correct = current.gi === gi;
    answer(ctx, { target: `group${current.gi}`, actual: `group${gi}`, correct, latencyMs: clock.ms(), info, quiet: left.length > 1 });
    if (!correct) return setMissedOn(current.id);
    clock.reset();
    setPlaced((p) => ({ ...p, [current.id]: gi }));
    setPicked(null);
  };

  return (
    <Frame
      prompt={t("act.sort")}
      speakKey="sort"
      done={Object.keys(placed).length}
      total={items.length}
      action={!current && <ActionButton label={t("act.done")} onSelect={onDone} pulse />}
    >
      <div className="flex min-h-[120px] flex-wrap justify-center" style={{ gap: 12 + ctx.profile.spacing }}>
        {left.map((x) => (
          <Target
            key={x.id}
            label={VOCAB[x.id]?.word[ctx.learnLang] ?? x.id}
            onSelect={() => setPicked(x.id)}
            selected={x.id === current?.id}
            className={`grid place-items-center rounded-fk-lg border-4 bg-surface-2 shadow-soft transition ${x.id === current?.id ? "-translate-y-1 border-teal bg-teal-soft" : "border-transparent"}`}
            style={{ width: size, height: size }}
          >
            <ItemArt id={x.id} size={Math.round(size * 0.62)} />
          </Target>
        ))}
      </div>
      <div className="grid w-full max-w-3xl grid-cols-2" style={{ gap: 16 + ctx.profile.spacing }}>
        {activity.groups.map((g, gi) => (
          <Target
            key={gi}
            label={g.label[ctx.uiLang]}
            onSelect={(info) => drop(gi, info)}
            pulse={!!current && missedOn === current.id && ctx.profile.hintLevel >= 1 && current.gi === gi}
            className="flex min-h-[160px] w-full flex-col items-center justify-start gap-2 rounded-fk-lg border-4 border-dashed border-sky bg-sky-soft/60 p-4 transition hover:bg-sky-soft"
          >
            <span className="text-4xl" aria-hidden>
              {g.icon}
            </span>
            <span className="rounded-full bg-surface px-5 py-1.5 text-lg font-extrabold text-ink shadow-soft">{g.label[ctx.uiLang]}</span>
            <span className="flex flex-wrap justify-center gap-1">
              {items
                .filter((x) => placed[x.id] === gi)
                .map((x) => (
                  <ItemArt key={x.id} id={x.id} size={40} />
                ))}
            </span>
          </Target>
        ))}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- puzzle (archetype E)
export function Puzzle({ activity, onDone }: EngineProps<"puzzle">) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const g = activity.grid;
  const n = g * g;
  const [tray] = useState(() => {
    let order = shuffle(Array.from({ length: n }, (_, k) => k));
    while (n > 1 && order.every((v, k) => v === k)) order = shuffle(order);
    return order;
  });
  const [placed, setPlaced] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [missAt, setMissAt] = useState(0);
  const left = tray.filter((p) => !placed.includes(p));
  const current = picked !== null && left.includes(picked) ? picked : left[0];
  const board = Math.round((g === 2 ? 320 : 360) * ctx.profile.targetScale);
  const pieceCss = `calc(min(${board}px, 86vw) / ${g})`;
  const emoji = VOCAB[activity.item]?.emoji ?? "🧩";

  const drop = (slot: number, info: SelectInfo) => {
    if (current === undefined || placed.includes(slot)) return;
    const correct = current === slot;
    answer(ctx, { target: `slot${current}`, actual: `slot${slot}`, correct, latencyMs: clock.ms(), info, quiet: left.length > 1 });
    if (!correct) return setMissAt((m) => m + 1);
    clock.reset();
    setMissAt(0);
    setPlaced((p) => [...p, slot]);
    setPicked(null);
  };

  return (
    <Frame
      prompt={t("act.puzzle")}
      speakKey="puzzle"
      done={placed.length}
      total={n}
      action={current === undefined && <ActionButton label={t("act.done")} onSelect={onDone} pulse />}
    >
      <div className="flex flex-wrap items-center justify-center gap-6" style={{ ["--piece" as string]: pieceCss }}>
        <div className="grid rounded-2xl bg-surface-2 p-1.5 shadow-inner" style={{ gridTemplateColumns: `repeat(${g}, var(--piece))`, gap: 4 }}>
          {Array.from({ length: n }, (_, slot) =>
            placed.includes(slot) ? (
              <Piece key={slot} index={slot} g={g} emoji={emoji} />
            ) : (
              <Target
                key={slot}
                label={t("act.slot", { n: slot + 1 })}
                onSelect={(info) => drop(slot, info)}
                pulse={missAt > 0 && ctx.profile.hintLevel >= 1 && slot === current}
                className="rounded-xl border-4 border-dashed border-sky bg-surface/70"
                style={{ width: "var(--piece)", height: "var(--piece)" }}
              >
                <span className="sr-only">{slot + 1}</span>
              </Target>
            ),
          )}
        </div>
        <div className="grid content-start gap-3" style={{ gridTemplateColumns: `repeat(${g}, var(--piece))`, minHeight: `calc(var(--piece) * ${g})` }}>
          {left.map((p) => (
            <Target
              key={p}
              label={t("act.piece", { n: p + 1 })}
              onSelect={() => setPicked(p)}
              selected={p === current}
              className={`overflow-hidden rounded-xl border-4 transition ${p === current ? "-translate-y-1 border-teal shadow-lift" : "border-transparent shadow-soft"}`}
              style={{ width: "var(--piece)", height: "var(--piece)" }}
            >
              <Piece index={p} g={g} emoji={emoji} />
            </Target>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** One tile of the big picture: the full image offset inside an overflow-hidden square. */
function Piece({ index, g, emoji }: { index: number; g: number; emoji: string }) {
  const row = Math.floor(index / g);
  const col = index % g;
  return (
    <span className="relative block overflow-hidden rounded-lg" style={{ width: "var(--piece)", height: "var(--piece)" }} aria-hidden>
      <span
        className="absolute grid place-items-center"
        style={{
          width: `${g * 100}%`,
          height: `${g * 100}%`,
          left: `-${col * 100}%`,
          top: `-${row * 100}%`,
          containerType: "size",
          background: "radial-gradient(circle at 50% 45%, #fdf3d4 0%, #e1f1de 55%, #d6e6f8 100%)",
        }}
      >
        <span style={{ fontSize: "72cqw", lineHeight: 1 }}>{emoji}</span>
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- sentence builder
export function Sentence({ activity, onDone }: EngineProps<"sentence">) {
  const ctx = usePlay();
  const [sentences] = useState(() => activity.sentences[ctx.learnLang].slice(0, 3));
  const [i, setI] = useState(0);
  const last = i + 1 >= sentences.length;
  return <SentenceRound key={i} text={sentences[i]} index={i} total={sentences.length} last={last} next={() => (last ? onDone() : setI(i + 1))} />;
}

function SentenceRound({ text, index, total, last, next }: { text: string; index: number; total: number; last: boolean; next: () => void }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const words = text.split(" ");
  const [cards] = useState(() => {
    let order = shuffle(words.map((w, k) => ({ w, k })));
    while (words.length > 1 && order.every((c, k) => c.k === k)) order = shuffle(order);
    return order;
  });
  const [used, setUsed] = useState<number[]>([]);
  const hint = useHint(() => ctx.say(text, ctx.learnLang));
  const pos = used.length;
  const solved = pos >= words.length;

  const tap = (k: number, info: SelectInfo) => {
    if (solved) return;
    // Equal words (e.g. "the … the") are interchangeable.
    const correct = words[k] === words[pos];
    answer(ctx, { target: words[pos], actual: words[k], correct, latencyMs: clock.ms(), info, quiet: pos + 1 < words.length });
    if (!correct) return hint.miss();
    clock.reset();
    setUsed([...used, k]);
    if (pos + 1 === words.length) setTimeout(() => ctx.say(text, ctx.learnLang), 700);
  };

  return (
    <Frame
      prompt={t("act.sentence")}
      speak={[[t("act.sentence"), "ui"], [text, "learn"]]}
      speakKey={`r${index}`}
      done={index + (solved ? 1 : 0)}
      total={total}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      <div className="flex min-h-24 w-full max-w-3xl flex-wrap items-center justify-center gap-3 rounded-fk-lg border-4 border-dashed border-sky bg-sky-soft/50 p-4">
        {words.slice(0, pos).map((w, k) => (
          <span key={k} className="fk-pop rounded-2xl bg-surface px-5 py-3 text-2xl font-extrabold text-ink shadow-soft">
            {w}
          </span>
        ))}
        {!solved && <span className="h-14 w-24 rounded-2xl border-2 border-dashed border-sky" aria-hidden />}
      </div>
      <div className="flex flex-wrap justify-center" style={{ gap: 12 + ctx.profile.spacing }}>
        {cards
          .filter(({ k }) => !used.includes(k))
          .map(({ w, k }) => (
            <Target
              key={k}
              label={w}
              onSelect={(info) => tap(k, info)}
              pulse={!solved && hint.show && w === words[pos]}
              className="rounded-2xl bg-sun-soft px-6 text-2xl font-extrabold text-ink shadow-soft hover:bg-[#fbe9b4]"
              style={{ minHeight: sizeFor(ctx, 84) }}
            >
              {w}
            </Target>
          ))}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- story read-along
export function Story({ activity, onDone }: EngineProps<"story">) {
  const ctx = usePlay();
  const t = useActT();
  const [page, setPage] = useState(0);
  const pages = activity.pages;
  const total = pages.length + (activity.question ? 1 : 0);
  const [question] = useState(() => activity.question && sceneSpec(activity.question, ctx.uiLang, ctx.profile.optionCount, sizeFor(ctx, 170)));

  if (page >= pages.length && question) return <ChoiceEngine rounds={[question]} onDone={onDone} offset={pages.length} total={total} />;
  const p = pages[Math.min(page, pages.length - 1)];
  const lastPage = page + 1 >= pages.length;
  return (
    <Frame
      prompt={t("act.story")}
      speak={[[p.text[ctx.learnLang], "learn"]]}
      speakKey={`p${page}`}
      done={page}
      total={total}
      action={<ActionButton label={t(lastPage && !question ? "act.done" : "act.next")} onSelect={() => (lastPage && !question ? onDone() : setPage(page + 1))} />}
    >
      <ScenePanel scene={p.scene} size={sizeFor(ctx, 220)} />
      <p className="max-w-2xl text-center text-3xl font-extrabold leading-snug text-ink">{p.text[ctx.learnLang]}</p>
    </Frame>
  );
}
