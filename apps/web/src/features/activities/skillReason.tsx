"use client";

import { useState, type ReactNode } from "react";
import { ItemArt, itemLabel, times } from "@/components/ItemArt";
import { usePlay } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";
import { CIRCLE, E, N, S, turn, W, watered, wet, type BalanceRound, type Clue, type LogicHousesRound, type NextPatternRound, type PipesRound, type Scale } from "@/lib/games/reasoning";
import { ChoiceEngine, PromptCard, type ChoiceSpec } from "./choice";
import { ActionButton, answer, denseSize, Frame, sizeFor, useActT, useClock, useHint } from "./kit";
import { Series, useBox, type PlayerProps } from "./skillKit";

// Players of the new Reasoning games (games spec 8 Nov 2026, §6.4).

// ---------------------------------------------------------------- next_pattern
export function NextPatternPlayer({ rounds, onDone }: PlayerProps<"next_pattern">) {
  const ctx = usePlay();
  const t = useActT();
  const [specs] = useState(() =>
    rounds.map((r): ChoiceSpec => ({ answer: r.answer, options: r.options, prompt: t(r.mode === "grid" ? "act.skill.next.grid" : "act.skill.next"), size: denseSize(ctx, r.options.length, 120), stage: <Pattern r={r} /> })),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

const Gap = ({ size }: { size: string }) => (
  <span className="grid place-items-center rounded-xl border-4 border-dashed border-sky bg-surface font-extrabold text-muted" style={{ width: size, height: size, fontSize: `calc(${size} * 0.5)` }} aria-hidden>
    ?
  </span>
);
/** The row with a gap at its end, or the grid with its last cell empty. */
function Pattern({ r }: { r: NextPatternRound }) {
  if (r.mode === "grid") {
    const n = r.size!;
    const cell = `min(${n === 2 ? 84 : 68}px, ${n === 2 ? 12 : 8.5}dvh)`;
    return (
      <div className="grid gap-1.5 rounded-fk-lg bg-surface-2 p-2 shadow-inner" style={{ gridTemplateColumns: `repeat(${n}, ${cell})` }}>
        {r.seq.map((id, k) =>
          k === r.seq.length - 1 ? (
            <Gap key={k} size={cell} />
          ) : (
            <span key={k} className="grid place-items-center rounded-xl bg-surface" style={{ width: cell, height: cell }}>
              <ItemArt id={id} size={times(cell, 0.78)} />
            </span>
          ),
        )}
      </div>
    );
  }
  const n = r.seq.length + 1;
  const cell = `min(60px, calc((100vw - 96px) / ${n}))`;
  return (
    <div className="flex items-center justify-center gap-1 rounded-fk-lg bg-surface-2 p-2 shadow-inner">
      {r.seq.map((id, k) => (
        <ItemArt key={k} id={id} size={cell} />
      ))}
      <Gap size={cell} />
    </div>
  );
}

// ---------------------------------------------------------------- balance
export function BalancePlayer({ rounds, onDone }: PlayerProps<"balance">) {
  const ctx = usePlay();
  const t = useActT();
  const [specs] = useState(() =>
    rounds.map((r): ChoiceSpec => {
      const many = r.options.length > 2;
      const key = r.ask === "count" ? "act.skill.balance.count" : r.ask === "heavy" ? (many ? "act.skill.balance.heaviest" : "act.skill.balance.heavy") : many ? "act.skill.balance.lightest" : "act.skill.balance.light";
      return { answer: r.answer, options: r.options, prompt: t(key), size: denseSize(ctx, r.options.length, 110), stage: <Scales r={r} /> };
    }),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

function Scales({ r }: { r: BalanceRound }) {
  // Three scales (two plus the question) sit two to a row on a phone.
  const small = r.scales.length + (r.ask === "count" ? 1 : 0) > 2;
  return (
    <div className="flex max-w-3xl flex-wrap items-end justify-center gap-x-4 gap-y-2">
      {r.scales.map((s, k) => (
        <ScaleArt key={k} s={s} small={small} />
      ))}
      {r.ask === "count" && <ScaleArt s={{ left: r.asked!, right: [], tilt: 0 }} small={small} right={<span className="flex items-center gap-0.5 text-2xl font-extrabold text-ink"><ItemArt id={CIRCLE} size={26} />×?</span>} />}
    </div>
  );
}
/** A simple scale: a beam on a stand, the heavier pan lower. Pictures sit in the pans. */
function ScaleArt({ s, right, small }: { s: Scale; right?: ReactNode; small?: boolean }) {
  const many = Math.max(s.left.length, s.right.length);
  const item = many > 3 ? 22 : many > 1 ? (small ? 24 : 28) : small ? 30 : 36;
  const pan = (xs: string[], dy: number, extra?: ReactNode) => (
    <div className={`flex ${small ? "w-[74px]" : "w-[104px]"} flex-col items-center transition-transform duration-500`} style={{ transform: `translateY(${dy}px)` }}>
      <div className="flex min-h-[40px] flex-wrap items-end justify-center gap-0.5">{extra ?? xs.map((x, k) => <ItemArt key={k} id={x} size={item} />)}</div>
      <div className="h-2.5 w-full rounded-b-full bg-[#c9a66b] shadow-soft" />
    </div>
  );
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <div className="flex items-end gap-1">
        {pan(s.left, s.tilt * -10)}
        {pan(s.right, s.tilt * 10, right)}
      </div>
      <div className={`h-2 ${small ? "w-[146px]" : "w-[200px]"} rounded-full bg-[#8d6e46] transition-transform duration-500`} style={{ transform: `rotate(${s.tilt * 6}deg)` }} />
      <div className={`${small ? "h-5" : "h-8"} w-3 bg-[#8d6e46]`} />
      <div className="h-2 w-16 rounded-full bg-[#8d6e46]" />
    </div>
  );
}

// ---------------------------------------------------------------- pipes
export function PipesPlayer({ rounds, onDone }: PlayerProps<"pipes">) {
  return <Series rounds={rounds} onDone={onDone} render={(r, i, next, last) => <PipesBoard key={i} r={r} next={next} last={last} />} />;
}

const GAP = 3;
const SIDE = 34; // the column for the tap and the flowers beside the board
/**
 * Turn pieces until water runs from the tap to every flower. A tap (or a switch select) turns a piece a quarter.
 * Turning a piece of the made path the right way is a step forward; turning a spare piece, or one that was already
 * right, is a wrong turn: after 2 a wrong piece pulses, after 4 the pieces that need no turn fade. On a phone a big
 * board shows some columns at a time, with "Look left / right" (no scrolling).
 */
function PipesBoard({ r, next, last }: { r: PipesRound; next: () => void; last: boolean }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const hint = useHint();
  const { attach, w: boxW, h: boxH } = useBox();
  const [cells, setCells] = useState(r.start);
  const [from, setFrom] = useState(0);
  const solved = watered(r, cells);
  const water = wet(r, cells);
  const wrongPiece = cells.findIndex((m, i) => r.path[i] && m !== r.solution[i]);

  // The biggest cell that fits; under 60 px on a phone, fewer columns at a time.
  const room = (boxW || 600) - 2 * SIDE;
  const fitH = Math.floor(((boxH || 500) - (r.flowers.length > 1 ? SIDE : 0) - 70 - GAP * r.rows) / r.rows);
  let cell = Math.min(84, Math.floor((room - GAP * r.cols) / r.cols), fitH);
  let shown = r.cols;
  if (cell < 60) {
    cell = Math.max(60, Math.min(84, fitH));
    shown = Math.max(3, Math.min(r.cols, Math.floor((room + GAP) / (cell + GAP))));
  }
  const start = Math.min(from, r.cols - shown);
  const cols = Array.from({ length: shown }, (_, k) => start + k);

  const tap = (i: number, info: SelectInfo) => {
    if (solved) return;
    const now = cells.map((m, k) => (k === i ? turn(m) : m));
    setCells(now);
    const done = watered(r, now);
    const wasRight = cells[i] === r.solution[i];
    const nowRight = now[i] === r.solution[i];
    if (r.path[i] && nowRight && !wasRight) {
      answer(ctx, { target: `pipe${i}`, actual: `pipe${i}`, correct: true, latencyMs: clock.ms(), info, quiet: !done });
      clock.reset();
      hint.reset();
    } else if (done) answer(ctx, { target: `pipe${i}`, actual: `pipe${i}`, correct: true, latencyMs: clock.ms(), info });
    else if (!r.path[i] || wasRight) {
      answer(ctx, { target: `pipe${wrongPiece}`, actual: `pipe${i}`, correct: false, latencyMs: clock.ms(), info });
      hint.miss();
    }
  };

  const flowerAt = (row: number, col: number, dir: number) => r.flowers.some((f) => f.r === row && f.c === col && f.dir === dir);
  const bloom = (row: number, col: number) => water.has(row * r.cols + col) && (cells[row * r.cols + col] & (flowerAt(row, col, E) ? E : S)) !== 0;
  return (
    <Frame
      prompt={t(r.flowers.length > 1 ? "act.skill.pipes.two" : "act.skill.pipes")}
      speakKey="pipes"
      done={solved ? 1 : 0}
      total={1}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      <div ref={attach} className="relative min-h-0 w-full max-w-4xl flex-1">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="grid" style={{ gridTemplateColumns: `${SIDE}px repeat(${shown}, ${cell}px) ${SIDE}px`, gap: GAP }}>
            {Array.from({ length: r.rows }, (_, row) => [
              <span key={`s${row}`} className="grid place-items-center text-2xl" aria-hidden>
                {row === r.source && start === 0 ? "🚰" : ""}
              </span>,
              ...cols.map((col) => {
                const i = row * r.cols + col;
                const rest = hint.fade && !solved && (!r.path[i] || cells[i] === r.solution[i]);
                return (
                  <Target
                    key={i}
                    label={t("act.skill.pipe", { n: i + 1 })}
                    onSelect={(info) => tap(i, info)}
                    disabled={solved || rest}
                    scanSkip={rest}
                    pulse={hint.show && !solved && i === wrongPiece}
                    className={`rounded-lg bg-[#e9dcb8] disabled:opacity-100 ${rest ? "opacity-40 disabled:opacity-40" : ""}`}
                    style={{ width: cell, height: cell, minWidth: 60, minHeight: 60 }}
                  >
                    <PipeArt mask={cells[i]} wet={water.has(i)} />
                  </Target>
                );
              }),
              <span key={`f${row}`} className="grid place-items-center text-3xl" aria-hidden>
                {start + shown === r.cols && flowerAt(row, r.cols - 1, E) ? (bloom(row, r.cols - 1) ? "🌸" : "🌱") : ""}
              </span>,
            ])}
            {r.flowers.some((f) => f.dir === S) && [
              <span key="bl" />,
              ...cols.map((col) => (
                <span key={`b${col}`} className="grid place-items-center text-3xl" style={{ height: SIDE }} aria-hidden>
                  {flowerAt(r.rows - 1, col, S) ? (bloom(r.rows - 1, col) ? "🌸" : "🌱") : ""}
                </span>
              )),
              <span key="br" />,
            ]}
          </div>
          {shown < r.cols && (
            <div className="flex gap-3">
              <Target label={t("act.skill.pipes.left")} onSelect={() => setFrom(Math.max(0, start - (shown - 1)))} disabled={start === 0} className="rounded-full bg-sky-soft px-5 font-extrabold text-ink shadow-soft disabled:opacity-40">
                ◀ {t("act.skill.pipes.left")}
              </Target>
              <Target label={t("act.skill.pipes.right")} onSelect={() => setFrom(Math.min(r.cols - shown, start + shown - 1))} disabled={start + shown >= r.cols} className="rounded-full bg-sky-soft px-5 font-extrabold text-ink shadow-soft disabled:opacity-40">
                {t("act.skill.pipes.right")} ▶
              </Target>
            </div>
          )}
        </div>
      </div>
    </Frame>
  );
}

/** A pipe piece: arms from the middle to each open side; blue once water runs through it. */
function PipeArt({ mask, wet: isWet }: { mask: number; wet: boolean }) {
  const color = isWet ? "#5b9be0" : "#9aa6b8";
  const arms: [number, string][] = [
    [N, "M50 50V0"],
    [E, "M50 50H100"],
    [S, "M50 50V100"],
    [W, "M50 50H0"],
  ];
  return (
    <svg viewBox="0 0 100 100" className="size-full" aria-hidden>
      {arms.map(([d, path]) => (mask & d ? <path key={d} d={path} stroke={color} strokeWidth="26" strokeLinecap="butt" /> : null))}
      <circle cx="50" cy="50" r="13" fill={color} />
    </svg>
  );
}

// ---------------------------------------------------------------- logic_houses
export function LogicHousesPlayer({ rounds, onDone }: PlayerProps<"logic_houses">) {
  return <Houses r={rounds[0]} onDone={onDone} />;
}

/** The clues on top, the houses below; one question per house, left to right, from the animals still waiting. */
function Houses({ r, onDone }: { r: LogicHousesRound; onDone: () => void }) {
  const ctx = usePlay();
  const t = useActT();
  const [q, setQ] = useState(0);
  const n = r.solution.length;
  const waiting = r.animals.filter((a) => !r.solution.slice(0, q).includes(a));
  const stage = (
    <div className="flex w-full max-w-3xl flex-col items-center gap-2">
      <ul className="flex flex-wrap justify-center gap-1.5">
        {r.clues.map((c, k) => (
          <ClueChip key={k} c={c} />
        ))}
      </ul>
      <div className="flex flex-wrap justify-center gap-1.5">
        {r.solution.map((a, h) => (
          <span key={h} className={`flex w-[60px] flex-col items-center rounded-2xl bg-sun-soft/70 pb-1 shadow-soft ${h === q ? "ring-4 ring-sky" : ""}`}>
            <span className="text-3xl leading-tight" aria-hidden>
              🏠
            </span>
            <span className="text-sm font-extrabold text-ink">{h + 1}</span>
            <span className="grid h-9 place-items-center">{h < q && <ItemArt id={a} size={32} />}</span>
          </span>
        ))}
      </div>
    </div>
  );
  const spec: ChoiceSpec = { answer: r.solution[q], options: waiting, prompt: t("act.skill.houses.ask", { n: q + 1 }), size: denseSize(ctx, waiting.length, 100), stage };
  return <ChoiceEngine key={q} rounds={[spec]} offset={q} total={n - 1} onDone={() => (q + 2 < n ? setQ(q + 1) : onDone())} />;
}

/** A clue in pictures, read out by its label: 🐱→🏠3 · 🐱🐶 (just right) · 🐱 … 🐶 (somewhere left) · 🐱↔🐶. */
function ClueChip({ c }: { c: Clue }) {
  const ctx = usePlay();
  const t = useActT();
  const name = (id: string) => itemLabel(id, ctx.learnLang, t);
  const label =
    c.t === "at" ? t("skill.clue.at", { a: name(c.a), n: c.h + 1 }) : t(`skill.clue.${c.t}`, { a: name(c.a), b: name(c.b) });
  const pic = (id: string) => <ItemArt id={id} size={30} />;
  return (
    <li className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xl font-extrabold text-ink shadow-soft" aria-label={label}>
      {c.t === "at" ? (
        <>
          {pic(c.a)}
          <span aria-hidden>→ 🏠{c.h + 1}</span>
        </>
      ) : c.t === "before" ? (
        <span className="flex items-center rounded-xl border-2 border-sky px-1" aria-hidden>
          {pic(c.a)}
          {pic(c.b)}
        </span>
      ) : (
        <>
          {pic(c.a)}
          <span aria-hidden>{c.t === "left" ? "…" : "↔"}</span>
          {pic(c.b)}
        </>
      )}
    </li>
  );
}

// ---------------------------------------------------------------- shadow_match
export function ShadowMatchPlayer({ rounds, onDone }: PlayerProps<"shadow_match">) {
  const ctx = usePlay();
  const t = useActT();
  const [specs] = useState(() =>
    rounds.map((r): ChoiceSpec => ({ answer: r.answer, options: r.options, prompt: t("act.skill.shadow"), size: denseSize(ctx, r.options.length, 120), stage: <PromptCard id={r.shadow} size={`min(${sizeFor(ctx, 150)}px, 18dvh)`} /> })),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}
