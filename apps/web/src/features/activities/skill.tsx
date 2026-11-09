"use client";

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { ItemArt, itemLabel, times, type Size } from "@/components/ItemArt";
import type { SkillGame } from "@/content/skillGames";
import { STORIES } from "@/content/stories";
import { PlayContext, usePlay, type PlayCtx } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";
import { makeRounds, type RoundOf, type SettingsOf, type SkillKind } from "@/lib/games";
import { sortFits, type MissingSkillRound, type PuzzleSkillRound, type SceneObject } from "@/lib/games/existing";
import { glyph, glyphId, type GlyphColor, type GlyphShape } from "@/lib/games/glyph";
import { CATEGORY_ICON, lookOf, numId, wordOf, type Category } from "@/lib/games/pools";
import { tokenize } from "@/lib/keys";
import type { ActivityStep } from "@/lib/types";
import { ChoiceEngine, PromptCard, ScenePanel, type ChoiceSpec } from "./choice";
import { MazeRound } from "./draw";
import { TypeRound } from "./keyboard";
import { ActionButton, answer, denseSize, fitSize, Frame, sizeFor, useActT, useClock, useHint, WatchAgain } from "./kit";
import { SequenceRound, useSequence } from "./memory";

// Skill games (games spec 8 Nov 2026, §2.3, §5): the 12 kinds of the theme worlds, now with 12 steps each. The rounds
// come from the kind's generator (lib/games) with the day's seed; the players below show them with the engines' own
// parts (ChoiceEngine, the sequence, maze and typing rounds), so hints, input modes and telemetry stay the same.

type PlayerProps<K extends SkillKind> = { rounds: RoundOf<K>[]; onDone: () => void };

/** Plays one step of a skill game. Every event carries the step, so the try counts at that step's difficulty. */
export function SkillPlay({ game, step, seed, onDone }: { game: SkillGame; step: ActivityStep; seed: string; onDone: () => void }) {
  const ctx = usePlay();
  const kind = game.kind;
  const [rounds] = useState(() => makeRounds(kind, step.settings as unknown as SettingsOf<typeof kind>, seed, ctx.learnLang));
  const inner: PlayCtx = useMemo(() => ({ ...ctx, activityId: game.id, emit: (e) => ctx.emit({ ...e, tier: step.tier, step: step.step }) }), [ctx, game.id, step.tier, step.step]);
  const Player = PLAYERS[kind] as ComponentType<PlayerProps<SkillKind>>;
  return (
    <PlayContext.Provider value={inner}>
      <Player rounds={rounds} onDone={onDone} />
    </PlayContext.Provider>
  );
}

/** Rounds one after another; `render` gets the round, its index and what to do next. */
function Series<R>({ rounds, onDone, render }: { rounds: R[]; onDone: () => void; render: (r: R, index: number, next: () => void, last: boolean) => ReactNode }) {
  const [i, setI] = useState(0);
  const last = i + 1 >= rounds.length;
  return <>{render(rounds[i], i, () => (last ? onDone() : setI(i + 1)), last)}</>;
}

// ---------------------------------------------------------------- choice kinds
function FindSamePlayer({ rounds, onDone }: PlayerProps<"find_same">) {
  const ctx = usePlay();
  const t = useActT();
  const [specs] = useState(() =>
    rounds.map((r): ChoiceSpec => ({ answer: r.options.find((o) => lookOf(o) === lookOf(r.target))!, options: r.options, prompt: t("act.find_same"), size: denseSize(ctx, r.options.length), stage: <PromptCard id={r.target} size={`min(${sizeFor(ctx, 150)}px, 13dvh)`} /> })),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

function ScenePlayer({ rounds, onDone }: PlayerProps<"scene">) {
  const ctx = usePlay();
  const t = useActT();
  const [specs] = useState(() =>
    rounds.map((r): ChoiceSpec => ({ answer: r.answer, options: r.options, prompt: t("act.skill.scene"), labels: true, size: denseSize(ctx, r.options.length, 110), stage: <SkillScene objects={r.objects} /> })),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

/** A picture with many things in it; a half-hidden thing sits behind a soft green bush. */
function SkillScene({ objects }: { objects: SceneObject[] }) {
  return (
    <div
      className="relative aspect-[16/9] overflow-hidden rounded-fk-lg border border-line shadow-inner [container-type:size]"
      style={{ width: "min(100%, 42rem, calc(40dvh * 16 / 9))", background: "linear-gradient(180deg,#e4effb 0%,#f4fbef 60%,#e1f1de 100%)" }}
      aria-hidden
    >
      {objects.map((o) => (
        <span key={o.id} className="absolute -translate-x-1/2 -translate-y-1/2 leading-none" style={{ left: `${o.x}%`, top: `${o.y}%`, fontSize: `${o.s}cqh` }}>
          {lookOf(o.id)}
          {o.hidden && <span className="absolute -inset-x-[12%] -bottom-[8%] h-[58%] rounded-t-[60%] bg-[#8cc98f] shadow-[inset_0_6px_0_rgb(255_255_255/0.35)]" />}
        </span>
      ))}
    </div>
  );
}

function ListenPickPlayer({ rounds, onDone }: PlayerProps<"listen_pick">) {
  const ctx = usePlay();
  const t = useActT();
  const [specs] = useState(() =>
    rounds.map((r): ChoiceSpec => {
      const word = wordOf(r.target, ctx.learnLang) ?? "";
      return {
        answer: r.target,
        options: r.options,
        prompt: t("act.listen_pick"),
        speak: [[t("act.listen_pick"), "ui"], [word, "learn"]],
        size: denseSize(ctx, r.options.length),
        // Pre-readers rely on audio; the word is shown only as extra help, and never at the steps without it.
        stage: !r.noWord && ctx.profile.hintLevel >= 2 ? <span className="rounded-full bg-sun-soft px-6 py-2 text-2xl font-extrabold text-ink">{word}</span> : undefined,
      };
    }),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

function CountPlayer({ rounds, onDone }: PlayerProps<"count">) {
  const t = useActT();
  const [specs] = useState(() =>
    rounds.map((r): ChoiceSpec => ({ answer: numId(r.groups.reduce((a, b) => a + b, 0)), options: r.options.map(numId), prompt: t("act.count"), stage: <CountStage groups={r.groups} by={r.by} item={r.item} /> })),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

const DOT: Record<number, string> = { 2: "#f4b183", 5: "#8cc98f", 10: "#7fa9e0" };
/** One by one: the pictures in rows of five. In groups: a card per group, its dots in rows of five. */
function CountStage({ groups, by, item }: { groups: number[]; by: number | "mixed"; item: string }) {
  if (by === 1) {
    const n = groups[0];
    const s = n <= 5 ? 64 : n <= 10 ? 52 : 44;
    return (
      <div className="grid justify-center gap-2 rounded-fk-lg bg-sun-soft/60 p-4" style={{ gridTemplateColumns: `repeat(${Math.min(5, n)}, ${s}px)` }}>
        {Array.from({ length: n }, (_, k) => <ItemArt key={k} id={item} size={s} />)}
      </div>
    );
  }
  return (
    <div className="flex max-w-2xl flex-wrap justify-center gap-2 rounded-fk-lg bg-sun-soft/60 p-3">
      {groups.map((g, k) => (
        <span key={k} className="grid gap-1 rounded-xl bg-surface p-2 shadow-soft" style={{ gridTemplateColumns: `repeat(${Math.min(5, g)}, 12px)` }} aria-hidden>
          {Array.from({ length: g }, (_, d) => <span key={d} className="size-3 rounded-full" style={{ background: DOT[g] ?? "#b3a8e8" }} />)}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- story
const STORY_BY_ID = Object.fromEntries(STORIES.map((s) => [s.id, s]));
function StoryPlayer({ rounds, onDone }: PlayerProps<"story">) {
  const ctx = usePlay();
  const t = useActT();
  const r = rounds[0];
  const s = STORY_BY_ID[r.story];
  const [page, setPage] = useState(0);
  const total = s.pages.length + r.questions.length;
  if (page >= s.pages.length) {
    const k = page - s.pages.length;
    const q = r.questions[k];
    const isPage = (id: string) => id.startsWith("p:");
    const spec: ChoiceSpec = {
      answer: q.answer,
      options: q.options,
      prompt: q.prompt[ctx.uiLang],
      labels: !q.ask,
      size: q.ask ? fitSize(130, q.options.length) : denseSize(ctx, q.options.length, 120),
      art: q.ask ? (id, size) => <span className="leading-none" style={{ fontSize: times(size, 0.26) }} aria-hidden>{s.pages[Number(id.slice(2))].scene}</span> : undefined,
      label: q.ask ? (id) => (isPage(id) ? s.pages[Number(id.slice(2))].text[ctx.learnLang] : id) : undefined,
    };
    return <ChoiceEngine key={k} rounds={[spec]} offset={page} total={total} onDone={() => (k + 1 < r.questions.length ? setPage(page + 1) : onDone())} />;
  }
  const p = s.pages[page];
  return (
    <Frame prompt={t("act.story")} speak={[[p.text[ctx.learnLang], "learn"]]} speakKey={`p${page}`} done={page} total={total} action={<ActionButton label={t("act.next")} onSelect={() => setPage(page + 1)} />}>
      <ScenePanel scene={p.scene} size={sizeFor(ctx, 200)} />
      <p className="max-w-2xl text-center text-3xl font-extrabold leading-snug text-ink short:text-2xl">{p.text[ctx.learnLang]}</p>
    </Frame>
  );
}

// ---------------------------------------------------------------- memory
function SequencePlayer({ rounds, onDone }: PlayerProps<"sequence">) {
  const ctx = usePlay();
  return (
    <Series
      rounds={rounds}
      onDone={onDone}
      render={(r, i, next, last) => <SequenceRound key={i} seq={r.seq} options={r.options} order={r.order} index={i} total={rounds.length} next={next} last={last} size={denseSize(ctx, r.options.length, 120)} />}
    />
  );
}

function MissingPlayer({ rounds, onDone }: PlayerProps<"missing">) {
  return <Series rounds={rounds} onDone={onDone} render={(r, i, next, last) => <MissingSkillRound key={i} r={r} index={i} total={rounds.length} next={next} last={last} />} />;
}

function MissingSkillRound({ r, index, total, next, last }: { r: MissingSkillRound; index: number; total: number; next: () => void; last: boolean }) {
  const ctx = usePlay();
  const t = useActT();
  const [q, setQ] = useState<number | "look">("look");
  const size = denseSize(ctx, r.shown.length, 120);
  const row = (cell: (k: number) => ReactNode) => (
    <div className="flex max-w-3xl flex-wrap justify-center gap-3 rounded-fk-lg bg-surface-2 p-4 shadow-inner short:p-2">
      {r.shown.map((_, k) => (
        <span key={k} className="grid place-items-center rounded-2xl bg-surface shadow-soft" style={{ width: size, height: size }}>
          {cell(k)}
        </span>
      ))}
    </div>
  );
  const art = (id: string) => <ItemArt id={id} size={times(size, 0.66)} />;

  if (q === "look")
    return (
      <Frame prompt={t("act.missing.look")} speakKey={`look${index}`} done={index} total={total} action={<ActionButton label={t("act.ready")} onSelect={() => setQ(0)} />}>
        {row((k) => art(r.shown[k]))}
      </Frame>
    );
  if (r.change === "swap") return <SwapRound r={r} index={index} total={total} next={next} last={last} size={size} />;
  // One question per empty place, left to right; the place asked about has a ring.
  const at = r.gone[q];
  const stage = row((k) => {
    const g = r.gone.indexOf(k);
    if (g < 0 || g < q) return art(r.shown[k]);
    return <span className={`grid size-full place-items-center rounded-2xl text-5xl font-extrabold text-muted ${g === q ? "ring-4 ring-sky" : ""}`}>?</span>;
  });
  return (
    <ChoiceEngine
      key={q}
      rounds={[{ answer: r.shown[at], options: r.options[q], prompt: t(r.gone.length > 1 ? "act.skill.missing.slot" : "act.missing"), stage, size: denseSize(ctx, r.options[q].length, 110) }]}
      offset={index}
      total={total}
      onDone={() => (q + 1 < r.gone.length ? setQ(q + 1) : next())}
    />
  );
}

/** Two pictures changed places: tap both. A tap on one already found does nothing; any other is a gentle miss. */
function SwapRound({ r, index, total, next, last, size }: { r: Extract<MissingSkillRound, { change: "swap" }>; index: number; total: number; next: () => void; last: boolean; size: Size }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const hint = useHint();
  const [found, setFound] = useState<number[]>([]);
  const solved = found.length === 2;
  const after = [...r.shown];
  [after[r.swap[0]], after[r.swap[1]]] = [after[r.swap[1]], after[r.swap[0]]];
  // Once both are found they swap back.
  const row = solved ? r.shown : after;
  const left = r.swap.filter((k) => !found.includes(k));

  const tap = (k: number, info: SelectInfo) => {
    if (solved || found.includes(k)) return;
    const correct = left.includes(k);
    answer(ctx, { target: `place${left[0]}`, actual: `place${k}`, correct, latencyMs: clock.ms(), info, quiet: correct && left.length > 1 });
    if (!correct) return hint.miss();
    clock.reset();
    hint.reset();
    setFound([...found, k]);
  };

  return (
    <Frame
      prompt={t("act.skill.missing.swap")}
      speakKey={`swap${index}`}
      done={index + (solved ? 1 : 0)}
      total={total}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      <div className="flex max-w-3xl flex-wrap justify-center gap-3 rounded-fk-lg bg-surface-2 p-4 shadow-inner short:p-2">
        {row.map((id, k) => {
          const rest = !solved && hint.fade && !left.includes(k) && !found.includes(k);
          return (
            <Target
              key={k}
              label={`${k + 1}`}
              onSelect={(info) => tap(k, info)}
              selected={found.includes(k)}
              pulse={!solved && hint.show && k === left[0]}
              disabled={solved || rest}
              scanSkip={rest || found.includes(k)}
              className={`grid place-items-center rounded-2xl border-4 bg-surface shadow-soft transition ${found.includes(k) ? "border-teal bg-teal-soft" : "border-transparent"} ${rest ? "opacity-25" : ""} disabled:opacity-100`}
              style={{ width: size, height: size }}
            >
              <ItemArt id={id} size={times(size, 0.66)} />
            </Target>
          );
        })}
      </div>
    </Frame>
  );
}

function LightPathPlayer({ rounds, onDone }: PlayerProps<"light_path">) {
  return <Series rounds={rounds} onDone={onDone} render={(r, i, next, last) => <GridLightRound key={i} grid={r.grid} seq={r.seq} reverse={r.reverse} index={i} total={rounds.length} next={next} last={last} />} />;
}

/** Stars on an n×n grid light up one after another; tap them in the same order, or from the last to the first. */
function GridLightRound({ grid, seq, reverse, index, total, next, last }: { grid: number; seq: number[]; reverse: boolean; index: number; total: number; next: () => void; last: boolean }) {
  const t = useActT();
  const [solved, setSolved] = useState(false);
  const [ids] = useState(() => seq.map((c) => `c${c}`));
  const [expect] = useState(() => (reverse ? [...ids].reverse() : ids));
  const s = useSequence(ids, () => setSolved(true), expect);
  const watching = s.phase === "watch";
  const done = watching ? [] : expect.slice(0, s.pos);
  return (
    <Frame
      prompt={t(watching ? "act.light_path.watch" : reverse ? "act.skill.light.back" : "act.light_path.repeat")}
      speakKey={`r${index}`}
      done={index + (solved ? 1 : 0)}
      total={total}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      {/* The sky beside "Show me again" when there is room (a laptop), above it on a phone. A star is at least 76 px,
          except on a 5×5 sky on a phone: 60 px, the most that fits across (see the B82 note). */}
      <div className="flex w-full flex-wrap items-center justify-center gap-4">
      <div
        className="grid gap-1.5 rounded-fk-lg p-2 shadow-inner"
        style={{ width: `min(100%, ${grid * 5.5}rem, 66dvh)`, gridTemplateColumns: `repeat(${grid}, 1fr)`, background: "linear-gradient(180deg,#34497a 0%,#4a5f93 60%,#62709e 100%)" }}
      >
        {Array.from({ length: grid * grid }, (_, c) => {
          const id = `c${c}`;
          const on = (watching && ids[s.lit] === id) || done.includes(id);
          const rest = !!s.fadeExcept && s.fadeExcept !== id;
          return (
            <Target
              key={id}
              label={t("act.star", { n: c + 1 })}
              disabled={watching || solved || rest}
              scanSkip={rest}
              onSelect={(info) => s.tap(id, info)}
              pulse={s.hintId === id}
              className={`grid aspect-square place-items-center rounded-full ${rest && !on ? "opacity-25" : "disabled:opacity-100"}`}
              style={{ minWidth: 60, minHeight: 60 }}
            >
              <span
                className={`block rounded-full transition-all duration-300 ${on ? "fk-glow bg-sun" : "bg-[#8d9cc4]"}`}
                style={{ width: on ? "56%" : "30%", height: on ? "56%" : "30%", boxShadow: on ? "0 0 24px 8px rgb(245 210 114 / .55)" : undefined }}
              />
            </Target>
          );
        })}
      </div>
      <WatchAgain onSelect={s.replay} disabled={watching || solved} />
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- sort
function SortPlayer({ rounds, onDone }: PlayerProps<"sort">) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const hint = useHint();
  const r = rounds[0];
  const [placed, setPlaced] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const left = r.items.filter((x) => !(x in placed));
  // Only the next three wait in the tray, so a board of 16 still fits the screen.
  const tray = left.slice(0, 3);
  const current = tray.find((x) => x === picked) ?? tray[0];
  const boxOf = (item: string) => r.groups.findIndex((g) => sortFits(g, item));
  const size = fitSize(sizeFor(ctx, 96), 3);
  const four = r.groups.length === 4;

  const drop = (gi: number, info: SelectInfo) => {
    if (!current) return;
    const correct = boxOf(current) === gi;
    answer(ctx, { target: `group${boxOf(current)}`, actual: `group${gi}`, correct, latencyMs: clock.ms(), info, quiet: left.length > 1 });
    if (!correct) return hint.miss();
    clock.reset();
    hint.reset();
    setPlaced((p) => ({ ...p, [current]: gi }));
    setPicked(null);
  };

  return (
    <Frame prompt={t("act.sort")} speakKey="sort" done={Object.keys(placed).length} total={r.items.length} action={!current && <ActionButton label={t("act.done")} onSelect={onDone} pulse />}>
      <div className="flex justify-center" style={{ gap: 12 + ctx.profile.spacing, minHeight: size }}>
        {tray.map((id) => (
          <Target
            key={id}
            label={itemLabel(id, ctx.learnLang, t)}
            onSelect={() => setPicked(id)}
            selected={id === current}
            className={`grid place-items-center rounded-fk-lg border-4 bg-surface-2 shadow-soft transition ${id === current ? "-translate-y-1 border-teal bg-teal-soft" : "border-transparent"}`}
            style={{ width: size, height: size }}
          >
            <ItemArt id={id} size={times(size, 0.62)} />
          </Target>
        ))}
      </div>
      <div className={`grid w-full max-w-3xl ${r.groups.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} style={{ gap: 12 + ctx.profile.spacing }}>
        {r.groups.map((g, gi) => {
          const rest = !!current && hint.fade && boxOf(current) !== gi;
          return (
            <Target
              key={g}
              label={boxName(g, t)}
              onSelect={(info) => drop(gi, info)}
              pulse={!!current && hint.show && boxOf(current) === gi}
              disabled={rest}
              scanSkip={rest}
              className={`flex w-full flex-col items-center justify-start gap-1 rounded-fk-lg border-4 border-dashed border-sky bg-sky-soft/60 p-2 transition hover:bg-sky-soft ${four ? "min-h-[110px] short:min-h-[96px]" : "min-h-[140px] short:min-h-[110px]"} ${rest ? "opacity-25" : ""}`}
            >
              <span className="flex items-center gap-2">
                <BoxIcon group={g} />
                <span className="rounded-full bg-surface px-3 py-1 text-base font-extrabold text-ink shadow-soft sm:text-lg">{boxName(g, t)}</span>
              </span>
              <span className="flex flex-wrap justify-center gap-1">
                {r.items.filter((x) => placed[x] === gi).map((x) => <ItemArt key={x} id={x} size={28} />)}
              </span>
            </Target>
          );
        })}
      </div>
    </Frame>
  );
}

type T = ReturnType<typeof useActT>;
function boxName(group: string, t: T): string {
  const [by, a, b] = group.split(":");
  if (by === "cat") return t(`skill.cat.${a}`);
  if (by === "color") return t(`skill.color.${a}`);
  if (by === "shape") return t(`skill.shape.${a}`);
  return t("skill.glyph", { color: t(`skill.color.${a}`), shape: t(`skill.shape.${b}`) });
}
function BoxIcon({ group }: { group: string }) {
  const [by, a, b] = group.split(":");
  if (by === "cat") return <span className="text-3xl" aria-hidden>{CATEGORY_ICON[a as Category]}</span>;
  const g = by === "color" ? glyph({ shape: "circle", color: a as GlyphColor }) : by === "shape" ? glyph({ shape: a as GlyphShape, color: "shadow" }) : glyph({ shape: b as GlyphShape, color: a as GlyphColor });
  return <ItemArt id={glyphId(g)} size={36} />;
}

// ---------------------------------------------------------------- maze
function MazePlayer({ rounds, onDone }: PlayerProps<"maze">) {
  return (
    <Series
      rounds={rounds}
      onDone={onDone}
      render={(r, i, next, last) => <MazeRound key={i} n={r.n} walls={r.open} keyCell={r.key} door={r.door} index={i} total={rounds.length} next={next} last={last} />}
    />
  );
}

// ---------------------------------------------------------------- puzzle
function PuzzlePlayer({ rounds, onDone }: PlayerProps<"puzzle">) {
  return <SkillPuzzle r={rounds[0]} onDone={onDone} />;
}

/**
 * A picture cut into g×g pieces. Pick a piece (the next three wait in the tray), turn it with the Turn button if it
 * lies turned, then choose its place. A right place with the piece still turned is a gentle miss: the hint then
 * points at Turn.
 */
function SkillPuzzle({ r, onDone }: { r: PuzzleSkillRound; onDone: () => void }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const hint = useHint();
  const g = r.grid;
  const n = g * g;
  const [rot, setRot] = useState(r.rot);
  const [placed, setPlaced] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const left = r.tray.filter((p) => !placed.includes(p));
  const tray = left.slice(0, 3);
  const current = picked !== null && tray.includes(picked) ? picked : tray[0];
  const turned = current !== undefined && rot[current] !== 0;
  const anyTurns = r.rot.some((x) => x !== 0);
  const board = Math.round((g === 2 ? 260 : g === 3 ? 300 : 360) * ctx.profile.targetScale);
  // A place on the board is at least 76 px, except on a 5×5 board on a phone: 60 px, the most that fits across.
  const pieceCss = `calc(min(${board}px, 100vw - 84px, 50dvh) / ${g})`;

  const drop = (slot: number, info: SelectInfo) => {
    if (current === undefined || placed.includes(slot)) return;
    const correct = current === slot && !turned;
    answer(ctx, { target: `slot${current}`, actual: `slot${slot}`, correct, latencyMs: clock.ms(), info, quiet: left.length > 1 });
    if (!correct) return hint.miss();
    clock.reset();
    hint.reset();
    setPlaced((p) => [...p, slot]);
    setPicked(null);
  };

  // Turn sits where the Done button comes at the end (the action corner), so the board keeps the room on a phone.
  const turn = anyTurns && current !== undefined && (
    <Target
      label={t("act.skill.turn")}
      onSelect={() => setRot((x) => x.map((v, k) => (k === current ? (v + 90) % 360 : v)))}
      pulse={hint.show && turned}
      className="flex items-center gap-2 rounded-full bg-sun-soft px-8 text-xl font-extrabold text-ink shadow-soft hover:bg-[#fbe9b4]"
    >
      <span className="text-3xl" aria-hidden>↻</span>
      {t("act.skill.turn")}
    </Target>
  );
  return (
    <Frame prompt={t("act.puzzle")} speakKey="puzzle" done={placed.length} total={n} action={current === undefined ? <ActionButton label={t("act.done")} onSelect={onDone} pulse /> : turn}>
      <div className="flex flex-wrap items-center justify-center gap-6 short:gap-4" style={{ ["--piece" as string]: pieceCss }}>
        <div className="grid rounded-2xl bg-surface-2 p-1.5 shadow-inner" style={{ gridTemplateColumns: `repeat(${g}, var(--piece))`, gap: 3 }}>
          {Array.from({ length: n }, (_, slot) => {
            const rest = hint.fade && (turned || slot !== current);
            return placed.includes(slot) ? (
              <PicturePiece key={slot} index={slot} g={g} picture={r.picture} />
            ) : (
              <Target
                key={slot}
                label={t("act.slot", { n: slot + 1 })}
                onSelect={(info) => drop(slot, info)}
                pulse={hint.show && !turned && slot === current}
                disabled={rest}
                scanSkip={rest}
                className={`rounded-lg border-4 border-dashed border-sky bg-surface/70 ${rest ? "opacity-25" : ""}`}
                style={{ width: "var(--piece)", height: "var(--piece)", minWidth: 60, minHeight: 60 }}
              >
                <span className="sr-only">{slot + 1}</span>
              </Target>
            );
          })}
        </div>
        {/* The tray: the small whole picture, then the next three pieces (at most 72 px), all in one row on a phone. */}
        <div className="flex items-center gap-2" style={{ ["--piece" as string]: `min(${pieceCss}, 72px)` }}>
          {r.preview && (
            <span className="size-16 shrink-0 overflow-hidden rounded-xl shadow-soft sm:size-24" aria-hidden>
              <Picture picture={r.picture} />
            </span>
          )}
          {tray.map((p) => (
            <Target
              key={p}
              label={t("act.piece", { n: p + 1 })}
              onSelect={() => setPicked(p)}
              selected={p === current}
              className={`overflow-hidden rounded-xl border-4 transition ${p === current ? "-translate-y-1 border-teal shadow-lift" : "border-transparent shadow-soft"}`}
              style={{ width: "calc(var(--piece) + 8px)", height: "calc(var(--piece) + 8px)" }}
            >
              <span className="block transition-transform duration-300" style={{ transform: `rotate(${rot[p]}deg)` }}>
                <PicturePiece index={p} g={g} picture={r.picture} />
              </span>
            </Target>
          ))}
        </div>
      </div>
    </Frame>
  );
}
/** The whole picture: a soft two-way gradient (every piece has its own patch of it) with five pictures on it. */
function Picture({ picture }: { picture: string[] }) {
  const spots: [number, number, number][] = [[50, 50, 46], [20, 20, 20], [80, 20, 20], [20, 80, 20], [80, 80, 20]];
  return (
    <span
      className="relative block size-full [container-type:size]"
      style={{ background: "linear-gradient(90deg, rgb(253 214 160 / .75), rgb(160 200 245 / .75)), linear-gradient(180deg, #fff6e0, #cfe9cf)" }}
    >
      {picture.map((e, k) => (
        <span key={k} className="absolute -translate-x-1/2 -translate-y-1/2 leading-none" style={{ left: `${spots[k][0]}%`, top: `${spots[k][1]}%`, fontSize: `${spots[k][2]}cqw` }}>
          {e}
        </span>
      ))}
    </span>
  );
}

function PicturePiece({ index, g, picture }: { index: number; g: number; picture: string[] }) {
  const row = Math.floor(index / g);
  const col = index % g;
  return (
    <span className="relative block overflow-hidden rounded-md" style={{ width: "var(--piece)", height: "var(--piece)" }} aria-hidden>
      <span className="absolute" style={{ width: `${g * 100}%`, height: `${g * 100}%`, left: `-${col * 100}%`, top: `-${row * 100}%` }}>
        <Picture picture={picture} />
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- type
function TypePlayer({ rounds, onDone }: PlayerProps<"type">) {
  const ctx = usePlay();
  const letters = [...new Set(rounds.flatMap((r) => tokenize(r.text, ctx.learnLang)))];
  return (
    <Series
      rounds={rounds}
      onDone={onDone}
      render={(r, i, next, last) => (
        <TypeRound key={i} word={r.text} mode={r.mode} needed={r.mode === "letter" ? letters : tokenize(r.text, ctx.learnLang).filter((k) => k !== " ")} index={i} total={rounds.length} last={last} next={next} />
      )}
    />
  );
}

const PLAYERS: { [K in SkillKind]: ComponentType<PlayerProps<K>> } = {
  find_same: FindSamePlayer,
  scene: ScenePlayer,
  story: StoryPlayer,
  sequence: SequencePlayer,
  missing: MissingPlayer,
  light_path: LightPathPlayer,
  sort: SortPlayer,
  maze: MazePlayer,
  puzzle: PuzzlePlayer,
  listen_pick: ListenPickPlayer,
  type: TypePlayer,
  count: CountPlayer,
};
