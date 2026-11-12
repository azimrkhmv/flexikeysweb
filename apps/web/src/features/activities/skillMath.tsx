"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ItemArt, times, type Size } from "@/components/ItemArt";
import { usePlay } from "@/features/play/context";
import type { SelectInfo } from "@/features/play/Target";
import { numId, numOf } from "@/lib/games/pools";
import { lineText, moreLessAnswer, payWith, type BazaarRound, type Dot, type MissingNumberRound, type NumberLineRound, type Part } from "@/lib/games/math";
import { ChoiceEngine, type ChoiceSpec } from "./choice";
import { ActionButton, answer, Frame, OptionCard, fitSize, useActT, useClock, useHint, useLater } from "./kit";
import { Series, type PlayerProps } from "./skillKit";

// Players of the new Math games (games spec 8 Nov 2026, §6.5).

/** 37500 → "37 500". */
export const groupDigits = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// ---------------------------------------------------------------- more_less
export function MoreLessPlayer({ rounds, onDone }: PlayerProps<"more_less">) {
  const t = useActT();
  const [specs] = useState(() =>
    rounds.map(
      (r): ChoiceSpec => ({
        answer: moreLessAnswer(r),
        options: ["g0", "g1"],
        prompt: t(`act.skill.more.${r.ask}`),
        size: fitSize(230, 2),
        label: (id) => t("skill.group", { n: Number(id.slice(1)) + 1 }),
        art: (id, size) => <Dots dots={r.groups[Number(id.slice(1))]} cover={r.cover} size={size} />,
      }),
    ),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

/** A group of dots; with `cover`, clouds slide over them after that many seconds (no countdown is shown). */
function Dots({ dots, cover, size }: { dots: Dot[]; cover: number; size: Size }) {
  const later = useLater();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (cover) later(() => setHidden(true), cover * 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span className="relative grid place-items-center" style={{ width: times(size, 0.9), height: times(size, 0.9) }} aria-hidden>
      <svg viewBox="0 0 100 100" className="size-full">
        {dots.map((d, k) => (
          <circle key={k} cx={d.x * 100} cy={d.y * 100} r={[4.5, 6.5, 8.5][d.s]} fill="#7fa9e0" stroke="#4c78b8" strokeWidth="1.5" />
        ))}
      </svg>
      <span className={`absolute inset-0 grid place-items-center rounded-fk-lg bg-surface-2 transition-opacity duration-700 ${hidden ? "opacity-100" : "opacity-0"}`} style={{ fontSize: times(size, 0.4) }}>
        ☁️
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- number_line
export function NumberLinePlayer({ rounds, onDone }: PlayerProps<"number_line">) {
  const t = useActT();
  const [specs] = useState(() =>
    rounds.map((r): ChoiceSpec => {
      const text = lineText(r.target, r.frac);
      return {
        answer: `m${r.target}`,
        options: r.options.map((v) => `m${v}`),
        prompt: t("act.skill.line", { n: text }),
        size: 64,
        label: (id) => t("skill.mark", { n: r.options.indexOf(Number(id.slice(1))) + 1 }),
        art: () => <span className="text-3xl leading-none" aria-hidden>📍</span>,
        stage: <span className="rounded-fk-lg bg-sun-soft px-8 py-3 text-5xl font-extrabold text-ink shadow-soft short:py-2 short:text-4xl">{text}</span>,
        layout: (card) => <Line r={r} card={card} />,
      };
    }),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

/** The line with its marks; the cards to choose stand over their marks, every other one a row higher. */
function Line({ r, card }: { r: NumberLineRound; card: (id: string) => ReactNode }) {
  const marks = Array.from({ length: r.max / r.tick + 1 }, (_, k) => k * r.tick);
  const at = (v: number) => `${(v / r.max) * 100}%`;
  return (
    <div className="w-full max-w-4xl px-9">
      <div className="relative h-[156px]">
        {r.options.map((v, k) => (
          <div key={v} className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: at(v), bottom: 0 }}>
            {card(`m${v}`)}
            <span className="w-1 rounded-full bg-line" style={{ height: k % 2 ? 8 : 80 }} />
          </div>
        ))}
      </div>
      <div className="relative h-3 rounded-full bg-ink/70">
        {marks.map((v) => (
          <span key={v} className="absolute top-1/2 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: at(v), height: r.labels.includes(v) ? 28 : 18 }} />
        ))}
      </div>
      <div className="relative mt-4 h-8">
        {r.labels.map((v) => (
          <span key={v} className="absolute -translate-x-1/2 text-2xl font-extrabold text-ink" style={{ left: at(v) }}>
            {lineText(v, r.frac)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- bazaar
const NOTE_LOOK: Record<number, string> = { 500: "#e6d29a", 1000: "#bfe3c0", 2000: "#bcd6f2", 5000: "#f3c6d3", 10000: "#d4ccf2", 20000: "#f6cfa9", 50000: "#a9dcd5", 100000: "#9fc0ea" };
/** A so'm note as a simple coloured card with its number (the 500 coin is round); never a copy of a real note. */
function Note({ v, w }: { v: number; w: Size }) {
  const t = useActT();
  const coin = v === 500;
  return (
    <span
      className={`grid place-items-center border-2 border-ink/20 font-extrabold text-ink shadow-inner ${coin ? "rounded-full" : "rounded-xl"}`}
      style={{ width: coin ? times(w, 0.5) : times(w, 0.92), height: times(w, 0.5), background: NOTE_LOOK[v] ?? "#e9eef6" }}
      aria-hidden
    >
      <span className="text-center leading-tight">
        <span className="block" style={{ fontSize: typeof w === "number" ? Math.min(24, w * 0.2) : `min(1.5rem, calc(${w} * 0.2))` }}>
          {groupDigits(v)}
        </span>
        {!coin && <span className="block text-sm opacity-70">{t("skill.som", { n: "" }).trim()}</span>}
      </span>
    </span>
  );
}
/** The thing bought with its price tag. */
function PriceTag({ r }: { r: BazaarRound }) {
  const t = useActT();
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-fk-lg bg-sun-soft/60 px-4 py-1.5">
      <ItemArt id={r.item} size={56} />
      <span className="rounded-xl bg-surface px-3 py-1 text-2xl font-extrabold text-ink shadow-soft">🏷️ {t("skill.som", { n: groupDigits(r.price) })}</span>
      {r.paid && (
        <>
          <span className="text-2xl" aria-hidden>
            ⬅️
          </span>
          <Note v={r.paid} w={120} />
        </>
      )}
    </div>
  );
}

export function BazaarPlayer({ rounds, onDone }: PlayerProps<"bazaar">) {
  const t = useActT();
  const som = (v: number) => t("skill.som", { n: groupDigits(v) });
  const [specs] = useState(() =>
    rounds.map(
      (r): ChoiceSpec => ({
        answer: `v${r.mode === "change" ? r.paid! - r.price : r.price}`,
        options: r.options.map((v) => `v${v}`),
        prompt: r.mode === "change" ? t("act.skill.bazaar.change", { price: som(r.price), paid: som(r.paid!) }) : t("act.skill.bazaar.note", { price: som(r.price) }),
        size: fitSize(170, 2),
        height: 88,
        label: (id) => som(Number(id.slice(1))),
        art: (id, size) =>
          r.mode === "change" ? <span className="text-3xl font-extrabold text-ink">{groupDigits(Number(id.slice(1)))}</span> : <Note v={Number(id.slice(1))} w={times(size, 0.9)} />,
        stage: <PriceTag r={r} />,
      }),
    ),
  );
  if (rounds[0]?.mode === "pay") return <Series rounds={rounds} onDone={onDone} render={(r, i, next, last) => <PayRound key={i} r={r} index={i} total={rounds.length} next={next} last={last} />} />;
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

/** Pick notes from the wallet until they make the price; a note that does not belong in it is a gentle miss. */
function PayRound({ r, index, total, next, last }: { r: BazaarRound; index: number; total: number; next: () => void; last: boolean }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const hint = useHint();
  const som = (v: number) => t("skill.som", { n: groupDigits(v) });
  const right = payWith(r.options, r.price);
  const [got, setGot] = useState<number[]>([]);
  const [tried, setTried] = useState<number[]>([]);
  const left = right.filter((v) => !got.includes(v));
  const solved = !left.length;
  const paid = got.reduce((s, v) => s + v, 0);
  const choose = (v: number, info: SelectInfo) => {
    if (solved || got.includes(v)) return;
    const correct = right.includes(v);
    answer(ctx, { target: `v${left[0]}`, actual: `v${v}`, correct, latencyMs: clock.ms(), info, quiet: correct && left.length > 1 });
    if (!correct) {
      setTried((x) => [...x, v]);
      return hint.miss();
    }
    clock.reset();
    hint.reset();
    setGot((x) => [...x, v]);
  };
  // A big wallet (7–8 notes) sits three to a row on a phone.
  const many = r.options.length > 6;
  const w = fitSize(170, many ? 3 : 2);
  return (
    <Frame
      prompt={t("act.skill.bazaar.pay", { price: som(r.price) })}
      speakKey={`pay${index}`}
      done={index + (solved ? 1 : 0)}
      total={total}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        <PriceTag r={r} />
        <span className="rounded-full bg-teal-soft px-4 py-2 text-xl font-extrabold text-ink" aria-live="polite">
          {t("act.skill.bazaar.wallet", { n: som(paid) })}
        </span>
      </div>
      <div className="flex max-w-3xl flex-wrap justify-center gap-2">
        {r.options.map((v) => (
          <OptionCard
            key={v}
            label={som(v)}
            size={w}
            height={many ? 72 : 88}
            onSelect={(info) => choose(v, info)}
            pulse={!solved && hint.show && v === left[0]}
            faded={!solved && hint.fade && !left.includes(v)}
            state={got.includes(v) ? "solved" : tried.includes(v) ? "tried" : undefined}
          >
            <Note v={v} w={times(w, 0.9)} />
          </OptionCard>
        ))}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- missing_number
export function MissingNumberPlayer({ rounds, onDone }: PlayerProps<"missing_number">) {
  const t = useActT();
  const [specs] = useState(() =>
    rounds.map(
      (r): ChoiceSpec => ({
        answer: numId(r.answer),
        options: r.options.map(numId),
        prompt: t("act.skill.missing"),
        size: fitSize(110, r.options.length),
        label: (id) => String(numOf(id)),
        stage: <Sum r={r} />,
      }),
    ),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

/** The sum, the gap as a dashed box; small sums also show apples under each number. */
function Sum({ r }: { r: MissingNumberRound }) {
  const show = (p: Part) => (p === "?" ? "?" : typeof p === "number" ? String(p) : p);
  return (
    <div className="flex max-w-full flex-wrap items-start justify-center gap-x-1 gap-y-3 rounded-fk-lg bg-surface-2 px-2 py-3 shadow-inner sm:gap-x-2 sm:px-4" role="img" aria-label={r.parts.map(show).join(" ")}>
      {r.parts.map((p, k) => (
        <span key={k} className="flex flex-col items-center gap-1">
          <span
            className={`grid min-w-8 place-items-center rounded-xl px-0.5 text-3xl font-extrabold leading-[3rem] text-ink sm:min-w-14 sm:px-2 sm:text-5xl sm:leading-[4rem] ${p === "?" ? "border-4 border-dashed border-sky bg-surface" : ""}`}
          >
            {show(p)}
          </span>
          {r.pics && typeof p === "number" && (
            <span className="grid grid-cols-5 gap-0.5" aria-hidden>
              {Array.from({ length: p }, (_, j) => (
                <ItemArt key={j} id="apple" size={16} />
              ))}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
