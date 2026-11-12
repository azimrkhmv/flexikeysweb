"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ItemArt, itemLabel, times } from "@/components/ItemArt";
import { usePlay, type PlayCtx } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";
import { glyph, glyphId } from "@/lib/games/glyph";
import { fastSortFits, snapSame, type StarItem } from "@/lib/games/speed";
import { speedWindow } from "@/lib/skill";
import { ActionButton, fitSize, Frame, sizeFor, useActT } from "./kit";
import { BoxIcon, boxName, type PlayerProps } from "./skillKit";

// Players of the Speed games (games spec 8 Nov 2026, §7). Items come one by one; each waits the step's window
// (lib/skill.ts `speedWindow`). No clock, no countdown, no bar: the pace shows only by items coming faster. A late or
// missed item gently floats away and the next one comes: no red, no X, no sound. No hints either (§1: Speed games
// follow §7 instead). Touch only; the try records the answer and its time, and the scoring applies the window.

/** The pause between two items: shorter as the window gets shorter, so the pace grows with the step. */
const pauseOf = (ms: number) => Math.round(ms * 0.3);
/** The clock an item's time is read from (only ever read in a tap or a timer, never while drawing). */
const now = () => performance.now();

/**
 * A stream of `n` items, each live for `ms`. `start()` shows the first; `end(k)` closes item k (answered) and the next
 * comes after the pause; an item left alone closes by itself and calls `onLeft(k)`. `k` is n once all are done.
 */
function useStream(n: number, ms: number, onLeft: (k: number) => void) {
  const [k, setK] = useState(-1);
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);
  const t0 = useRef(0);
  const win = useRef<ReturnType<typeof setTimeout>>(undefined);
  const gap = useRef<ReturnType<typeof setTimeout>>(undefined);
  const left = useRef(onLeft);
  useEffect(() => {
    left.current = onLeft;
  });
  useEffect(
    () => () => {
      clearTimeout(win.current);
      clearTimeout(gap.current);
    },
    [],
  );
  const end = (at: number) => {
    liveRef.current = false;
    setLive(false);
    clearTimeout(win.current);
    gap.current = setTimeout(() => show(at + 1), pauseOf(ms));
  };
  const show = (next: number) => {
    setK(next);
    if (next >= n) return;
    liveRef.current = true;
    setLive(true);
    t0.current = now();
    win.current = setTimeout(() => {
      if (!liveRef.current) return;
      left.current(next);
      end(next);
    }, ms);
  };
  return {
    k,
    live,
    started: k >= 0,
    finished: k >= n,
    start: () => show(0),
    /** Answer item k now: its time, or null when it is no longer live (a tap during the pause). */
    answer(at: number): number | null {
      if (!liveRef.current || at !== k) return null;
      const took = Math.round(now() - t0.current);
      end(at);
      return took;
    },
  };
}

/** One try: the answer and its time. No praise and no "try again" sound at this pace (§7.2). */
function log(ctx: PlayCtx, e: { target: string; actual: string; correct: boolean; ms: number; info?: SelectInfo }) {
  ctx.emit({ type: "select", levelId: ctx.levelId, activityId: ctx.activityId, target: e.target, actual: e.actual, correct: e.correct, latencyMs: e.ms, offsetRatio: e.info?.offsetRatio, pointerType: e.info?.pointerType });
}

/** In: a soft pop. Out: a right answer grows and fades; anything else floats gently away. */
const ITEM: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" } },
  gone: (ok: boolean) => (ok ? { opacity: 0, scale: 1.25, transition: { duration: 0.22 } } : { opacity: 0, y: -36, transition: { duration: 0.32, ease: "easeOut" } }),
};

/** The screen before the stream (the prompt is said, nothing moves yet) and after it. */
function Bookends({ prompt, total, done, started, finished, onStart, onDone, children }: { prompt: string; total: number; done: number; started: boolean; finished: boolean; onStart: () => void; onDone: () => void; children: ReactNode }) {
  const t = useActT();
  const action = !started ? <ActionButton label={t("act.skill.go")} onSelect={onStart} pulse /> : finished ? <ActionButton label={t("act.done")} onSelect={onDone} pulse /> : null;
  return (
    <Frame prompt={prompt} speakKey="speed" done={done} total={total} action={action}>
      {children}
    </Frame>
  );
}

// ---------------------------------------------------------------- quick_snap
const YES = "yes";
const NO = "no";
export function QuickSnapPlayer({ rounds, onDone, at }: PlayerProps<"quick_snap">) {
  const ctx = usePlay();
  const t = useActT();
  const r = rounds[0];
  const ms = speedWindow(at?.tier ?? 1, at?.step ?? 1);
  const [ok, setOk] = useState(false);
  // The first card is only looked at; every later card left unanswered floats away.
  const s = useStream(r.seq.length, ms, (k) => {
    setOk(false);
    if (k > 0) log(ctx, { target: snapSame(r, k) ? YES : NO, actual: "none", correct: false, ms });
  });
  const pick = (id: string, info: SelectInfo) => {
    const k = s.k;
    if (k < 1) return;
    const took = s.answer(k);
    if (took === null) return;
    const correct = (id === YES) === snapSame(r, k);
    setOk(correct);
    log(ctx, { target: snapSame(r, k) ? YES : NO, actual: id, correct, ms: took, info });
  };
  const card = `min(${sizeFor(ctx, 190)}px, 24dvh)`;
  const btn = fitSize(sizeFor(ctx, 120), 2);
  const asking = s.live && s.k >= 1;
  return (
    <Bookends prompt={t("act.skill.snap")} total={r.seq.length - 1} done={Math.max(0, Math.min(s.k, r.seq.length) - 1)} started={s.started} finished={s.finished} onStart={s.start} onDone={onDone}>
      <div className="relative grid place-items-center rounded-fk-lg bg-surface-2 shadow-inner" style={{ width: `calc(${card} + 24px)`, height: `calc(${card} + 24px)` }} aria-live="polite">
        {!s.started && <ItemArt id={r.seq[0]} size={card} />}
        <AnimatePresence custom={ok}>
          {s.live && (
            <motion.span key={s.k} custom={ok} variants={ITEM} initial="hidden" animate="show" exit="gone" className="absolute inset-0 grid place-items-center">
              <ItemArt id={r.seq[s.k]} size={card} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {s.started && s.k === 0 && <p className="text-xl font-bold text-muted">{t("act.skill.snap.look")}</p>}
      <div className="flex justify-center gap-4">
        {[YES, NO].map((id) => (
          <Target
            key={id}
            label={t(id === YES ? "act.skill.yes" : "act.skill.no")}
            onSelect={(info) => pick(id, info)}
            disabled={!asking}
            className={`grid place-items-center rounded-fk-lg border-4 border-transparent bg-surface-2 shadow-soft transition hover:bg-sky-soft ${s.k >= 1 ? "" : "opacity-40"}`}
            style={{ width: btn, height: btn }}
          >
            <span className="flex flex-col items-center gap-1">
              <span className="leading-none" style={{ fontSize: times(btn, 0.36) }} aria-hidden>
                {id === YES ? "👍" : "✋"}
              </span>
              <span className="text-xl font-extrabold text-ink">{t(id === YES ? "act.skill.yes" : "act.skill.no")}</span>
            </span>
          </Target>
        ))}
      </div>
    </Bookends>
  );
}

// ---------------------------------------------------------------- tap_star
export function TapStarPlayer({ rounds, onDone, at }: PlayerProps<"tap_star">) {
  const ctx = usePlay();
  const t = useActT();
  const r = rounds[0];
  const ms = speedWindow(at?.tier ?? 1, at?.step ?? 1);
  const moons = r.items.some((x) => !x.star);
  const [ok, setOk] = useState(false);
  // Left alone: a moon is right (its time is the whole window), a star floats away.
  const s = useStream(r.items.length, ms, (k) => {
    const x = r.items[k];
    setOk(!x.star);
    log(ctx, { target: x.star ? "tap" : "leave", actual: "leave", correct: !x.star, ms });
  });
  const tap = (x: StarItem, k: number, info: SelectInfo) => {
    const took = s.answer(k);
    if (took === null) return;
    setOk(x.star);
    log(ctx, { target: x.star ? "tap" : "leave", actual: "tap", correct: x.star, ms: took, info });
  };
  const item = "max(64px, min(120px, 17dvh, calc((100vw - 110px) / 3)))";
  const x = s.live ? r.items[s.k] : undefined;
  return (
    <Bookends prompt={t(moons ? "act.skill.star.moon" : "act.skill.star")} total={r.items.length} done={Math.max(0, Math.min(s.k, r.items.length))} started={s.started} finished={s.finished} onStart={s.start} onDone={onDone}>
      <div
        className="relative grid grid-cols-3 grid-rows-2 overflow-hidden rounded-fk-lg shadow-inner"
        style={{ width: "min(100%, 40rem)", height: "min(44dvh, 22rem)", background: "linear-gradient(180deg,#34497a 0%,#4a5f93 60%,#62709e 100%)" }}
      >
        {!s.started && (
          <span className="col-span-3 row-span-2 flex items-center justify-center gap-6">
            <ItemArt id={glyphId(glyph({ shape: "star", color: "yellow", size: 2 }))} size={item} />
            {moons && <ItemArt id={r.items.find((i) => !i.star)!.id} size={item} />}
          </span>
        )}
        <AnimatePresence custom={ok}>
          {x && (
            <motion.span
              key={s.k}
              custom={ok}
              variants={ITEM}
              initial="hidden"
              animate="show"
              exit="gone"
              className="absolute grid place-items-center"
              style={{ left: `${((x.at % 3) + 0.5) * (100 / 3)}%`, top: `${(Math.floor(x.at / 3) + 0.5) * 50}%`, translateX: "-50%", translateY: "-50%" }}
            >
              <Target label={t(x.star ? "skill.shape.star" : "skill.shape.moon")} onSelect={(info) => tap(x, s.k, info)} className="grid place-items-center rounded-full" style={{ width: item, height: item }}>
                <ItemArt id={x.id} size={item} />
              </Target>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </Bookends>
  );
}

// ---------------------------------------------------------------- fast_sort
export function FastSortPlayer({ rounds, onDone, at }: PlayerProps<"fast_sort">) {
  const ctx = usePlay();
  const t = useActT();
  const r = rounds[0];
  const ms = speedWindow(at?.tier ?? 1, at?.step ?? 1);
  const [ok, setOk] = useState(false);
  const [placed, setPlaced] = useState<Record<string, number>>({});
  const boxOf = (item: string) => r.boxes.findIndex((b) => fastSortFits(b, item));
  const s = useStream(r.items.length, ms, (k) => {
    setOk(false);
    log(ctx, { target: `group${boxOf(r.items[k])}`, actual: "none", correct: false, ms });
  });
  const drop = (gi: number, info: SelectInfo) => {
    const k = s.k;
    const took = s.answer(k);
    if (took === null) return;
    const item = r.items[k];
    const correct = boxOf(item) === gi;
    setOk(correct);
    if (correct) setPlaced((p) => ({ ...p, [item]: gi }));
    log(ctx, { target: `group${boxOf(item)}`, actual: `group${gi}`, correct, ms: took, info });
  };
  const card = `min(${sizeFor(ctx, 130)}px, 17dvh)`;
  const four = r.boxes.length === 4;
  return (
    <Bookends prompt={t("act.skill.fast")} total={r.items.length} done={Math.max(0, Math.min(s.k, r.items.length))} started={s.started} finished={s.finished} onStart={s.start} onDone={onDone}>
      <div className="relative grid place-items-center" style={{ width: card, height: card }}>
        <AnimatePresence custom={ok}>
          {s.live && (
            <motion.span key={s.k} custom={ok} variants={ITEM} initial="hidden" animate="show" exit="gone" className="absolute inset-0 grid place-items-center rounded-fk-lg bg-surface-2 shadow-soft">
              <ItemArt id={r.items[s.k]} size={times(card, 0.7)} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className={`grid w-full max-w-3xl ${four ? "grid-cols-2 sm:grid-cols-4" : r.boxes.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} style={{ gap: 12 + ctx.profile.spacing }}>
        {r.boxes.map((b, gi) => (
          <Target
            key={b}
            label={boxName(b, t)}
            onSelect={(info) => drop(gi, info)}
            disabled={!s.live}
            className={`flex w-full flex-col items-center justify-start gap-1 rounded-fk-lg border-4 border-dashed border-sky bg-sky-soft/60 p-2 transition hover:bg-sky-soft ${four ? "min-h-[100px] short:min-h-[84px]" : "min-h-[124px] short:min-h-[96px]"}`}
          >
            <span className="flex items-center gap-2">
              <BoxIcon group={b} />
              <span className="rounded-full bg-surface px-3 py-1 text-base font-extrabold text-ink shadow-soft sm:text-lg">{boxName(b, t)}</span>
            </span>
            <span className="flex flex-wrap justify-center gap-1" aria-label={r.items.filter((x) => placed[x] === gi).map((x) => itemLabel(x, ctx.learnLang, t)).join(", ")}>
              {r.items.filter((x) => placed[x] === gi).map((x) => <ItemArt key={x} id={x} size={24} />)}
            </span>
          </Target>
        ))}
      </div>
    </Bookends>
  );
}
