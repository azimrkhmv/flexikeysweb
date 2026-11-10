"use client";

import { motion, useReducedMotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import { ItemArt, itemLabel, times } from "@/components/ItemArt";
import { usePlay } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";
import { nBackQuestions, type CardPairsRound, type NBackRound, type ShoppingRound } from "@/lib/games/memory";
import { baseId, lookOf, wordOf } from "@/lib/games/pools";
import { Flip } from "./anim";
import { ChoiceEngine, PromptCard, type ChoiceSpec } from "./choice";
import { ActionButton, answer, denseSize, fitSize, Frame, OptionCard, sizeFor, useActT, useClock, useHint, useLater } from "./kit";
import { bestGrid, Series, useBox, type PlayerProps } from "./skillKit";

// Players of the new Memory games (games spec 8 Nov 2026, §6.2).

// ---------------------------------------------------------------- card_pairs
export function CardPairsPlayer({ rounds, onDone }: PlayerProps<"card_pairs">) {
  return <Series rounds={rounds} onDone={onDone} render={(r, i, next, last) => <PairsBoard key={i} r={r} next={next} last={last} />} />;
}

/** Flips without a pair before one pair pulses for a moment (spec §6.2). */
const PAIR_HINT_AFTER = 4;

/**
 * Turn two cards: a pair stays up, two different ones turn back after a moment. A mismatch is a mistake only when
 * the child had already seen where the partner was; turning new cards is just looking. After 4 flips with no pair,
 * one pair pulses for a moment.
 */
function PairsBoard({ r, next, last }: { r: CardPairsRound; next: () => void; last: boolean }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const later = useLater();
  const { attach, w: boxW, h: boxH } = useBox();
  const n = r.cards.length;
  const [up, setUp] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [seen, setSeen] = useState<number[]>([]);
  const [flips, setFlips] = useState(0);
  const [pulse, setPulse] = useState<number[]>([]);
  const solved = matched.length === n;
  const partner = (k: number) => r.cards.findIndex((c, j) => j !== k && lookOf(c) === lookOf(r.cards[k]));
  const grid = bestGrid(n, boxW, boxH, 128);
  const size = Math.max(60, grid.size);

  const tap = (k: number, info: SelectInfo) => {
    if (solved || up.length >= 2 || up.includes(k) || matched.includes(k)) return;
    setSeen((s) => (s.includes(k) ? s : [...s, k]));
    if (!up.length) return setUp([k]);
    const a = up[0];
    setUp([a, k]);
    if (partner(a) === k) {
      answer(ctx, {
        target: baseId(r.cards[a]),
        actual: baseId(r.cards[k]),
        correct: true,
        latencyMs: clock.ms(),
        info,
        quiet: matched.length + 2 < n,
      });
      clock.reset();
      setFlips(0);
      setPulse([]);
      later(() => {
        setMatched((m) => [...m, a, k]);
        setUp([]);
      }, 450);
      return;
    }
    // The partner of the first card was seen before: a real mistake. Otherwise the child was still finding out.
    if (seen.includes(partner(a)))
      answer(ctx, {
        target: baseId(r.cards[a]),
        actual: baseId(r.cards[k]),
        correct: false,
        latencyMs: clock.ms(),
        info,
      });
    const f = flips + 2;
    if (f >= PAIR_HINT_AFTER) {
      const k0 = r.cards.findIndex((_, j) => !matched.includes(j));
      setPulse([k0, partner(k0)]);
      ctx.emit({
        type: "hint_shown",
        levelId: ctx.levelId,
        activityId: ctx.activityId,
      });
      later(() => setPulse([]), 2000);
      setFlips(0);
    } else setFlips(f);
    later(() => setUp([]), 900);
  };

  return (
    <Frame prompt={t("act.skill.pairs")} speakKey="pairs" done={matched.length / 2} total={n / 2} action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}>
      {/* The board takes the room the frame has left (its content is placed over it, so it never pushes the frame). */}
      <div ref={attach} className="relative min-h-0 w-full max-w-4xl flex-1">
        <div
          className="absolute inset-0 grid place-content-center"
          style={{
            gridTemplateColumns: `repeat(${grid.cols}, ${size}px)`,
            gap: 8,
          }}
        >
          {r.cards.map((id, k) => {
            const faceUp = up.includes(k) || matched.includes(k);
            return (
              <Target
                key={k}
                label={faceUp ? itemLabel(baseId(id), ctx.learnLang, t) : t("act.skill.card", { n: k + 1 })}
                onSelect={(info) => tap(k, info)}
                disabled={solved || matched.includes(k)}
                scanSkip={matched.includes(k)}
                selected={matched.includes(k)}
                pulse={pulse.includes(k)}
                className="rounded-fk-lg disabled:opacity-100"
                style={{
                  width: size,
                  height: size,
                  minWidth: 60,
                  minHeight: 60,
                }}
              >
                <Flip
                  up={faceUp}
                  size={size}
                  front={
                    <span className={`grid size-full place-items-center rounded-fk-lg border-4 shadow-soft ${matched.includes(k) ? "border-teal bg-teal-soft" : "border-transparent bg-surface-2"}`}>
                      <ItemArt id={id} size={Math.round(size * 0.62)} />
                    </span>
                  }
                  back={
                    <span
                      className="grid size-full place-items-center rounded-fk-lg bg-sky-soft text-2xl shadow-soft"
                      style={{
                        backgroundImage: "radial-gradient(circle at 30% 30%, rgb(255 255 255 / .55) 0 12%, transparent 13%)",
                      }}
                      aria-hidden
                    >
                      ⭐
                    </span>
                  }
                />
              </Target>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- shopping_list
export function ShoppingListPlayer({ rounds, onDone }: PlayerProps<"shopping_list">) {
  return <Series rounds={rounds} onDone={onDone} render={(r, i, next, last) => <ShopRound key={i} r={r} index={i} total={rounds.length} next={next} last={last} />} />;
}

/**
 * The list is said (and at the easy steps shown), then, at the hard steps, some fish swim for a while; then the child
 * picks the things from the shelf and presses Done. A thing not on the list is a gentle miss. No countdown is shown.
 */
function ShopRound({ r, index, total, next, last }: { r: ShoppingRound; index: number; total: number; next: () => void; last: boolean }) {
  const { show, replay, wait } = r;
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const later = useLater();
  const [phase, setPhase] = useState<"listen" | "wait" | "pick">("listen");
  const [got, setGot] = useState<string[]>([]);
  const [tried, setTried] = useState<string[]>([]);
  const [replayed, setReplayed] = useState(false);
  const hint = useHint();
  const words = r.list.map((id) => wordOf(id, ctx.learnLang) ?? itemLabel(id, ctx.learnLang, t)).join(", ");
  const left = r.list.filter((x) => !got.includes(x));
  const solved = phase === "pick" && !left.length;
  const size = denseSize(ctx, r.shelf.length, 120);

  useEffect(() => {
    if (phase === "pick") clock.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const ready = () => {
    if (!wait) return setPhase("pick");
    setPhase("wait");
    later(() => setPhase("pick"), wait * 1000);
  };
  const choose = (id: string, info: SelectInfo) => {
    if (solved || got.includes(id)) return;
    const correct = r.list.includes(id);
    answer(ctx, {
      target: left[0],
      actual: id,
      correct,
      latencyMs: clock.ms(),
      info,
      quiet: correct && left.length > 1,
    });
    if (!correct) {
      setTried((x) => [...x, id]);
      return hint.miss();
    }
    clock.reset();
    hint.reset();
    setGot((x) => [...x, id]);
  };

  if (phase === "listen")
    return (
      <Frame
        prompt={t("act.skill.shop.listen")}
        speak={[
          [t("act.skill.shop.listen"), "ui"],
          [words, "learn"],
        ]}
        speakKey={`list${index}`}
        done={index}
        total={total}
        action={<ActionButton label={t("act.ready")} onSelect={ready} />}
      >
        {show ? (
          <div className="flex max-w-3xl flex-wrap justify-center gap-3 rounded-fk-lg bg-sun-soft/60 p-4">
            {r.list.map((id) => (
              <span key={id} className="grid place-items-center rounded-2xl bg-surface shadow-soft" style={{ width: fitSize(110, 4), height: fitSize(110, 4) }}>
                <ItemArt id={id} size={times(fitSize(110, 4), 0.66)} />
              </span>
            ))}
          </div>
        ) : (
          <span className="text-8xl leading-none" aria-hidden>
            🛒
          </span>
        )}
      </Frame>
    );
  if (phase === "wait")
    return (
      <Frame prompt={t("act.skill.shop.wait")} speakKey={`wait${index}`} done={index} total={total}>
        <SwimmingFish />
      </Frame>
    );
  return (
    <Frame
      prompt={t("act.skill.shop.pick")}
      speakKey={`pick${index}`}
      done={index + (solved ? 1 : 0)}
      total={total}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      <div className="flex w-full flex-wrap items-center justify-center gap-3">
        {/* The basket: one empty place per thing on the list, filled as the child picks. */}
        <div
          className="flex min-h-[60px] max-w-full flex-wrap items-center justify-center gap-1.5 rounded-3xl bg-sun-soft px-3 py-1.5"
          aria-label={t("act.progress", {
            n: got.length,
            total: r.list.length,
          })}
        >
          <span className="text-3xl" aria-hidden>
            🧺
          </span>
          {r.list.map((_, k) => (
            <span key={k} className="grid size-9 place-items-center rounded-lg bg-surface shadow-soft sm:size-11">
              {got[k] && <ItemArt id={got[k]} size={26} />}
            </span>
          ))}
        </div>
        {replay && (
          <Target
            label={t("act.skill.shop.again")}
            onSelect={() => {
              setReplayed(true);
              ctx.say(words, ctx.learnLang);
            }}
            disabled={replayed || solved}
            className="rounded-full bg-sky-soft px-6 text-lg font-extrabold text-ink shadow-soft disabled:opacity-40"
          >
            🔁 {t("act.skill.shop.again")}
          </Target>
        )}
      </div>
      <div className="flex max-w-3xl flex-wrap justify-center gap-2">
        {r.shelf.map((id) => (
          <OptionCard
            key={id}
            label={itemLabel(id, ctx.learnLang, t)}
            size={size}
            onSelect={(info) => choose(id, info)}
            pulse={!solved && hint.show && id === left[0]}
            faded={!solved && hint.fade && !r.list.includes(id)}
            state={got.includes(id) ? "solved" : tried.includes(id) ? "tried" : undefined}
          >
            <ItemArt id={id} size={times(size, 0.62)} />
          </OptionCard>
        ))}
      </div>
    </Frame>
  );
}

/** A calm tank of fish swimming to and fro while the child keeps the list in mind. */
function SwimmingFish() {
  const reduce = useReducedMotionConfig();
  return (
    <div
      className="relative aspect-[16/9] overflow-hidden rounded-fk-lg border border-line shadow-inner"
      style={{
        width: "min(100%, 36rem, calc(40dvh * 16 / 9))",
        background: "linear-gradient(180deg,#cfe6fb 0%,#a9d2f2 70%,#e9dcb8 100%)",
      }}
      aria-hidden
    >
      {[18, 42, 66].map((top, k) => (
        <motion.span
          key={k}
          className="absolute text-5xl leading-none"
          style={{ top: `${top}%` }}
          initial={{ left: k % 2 ? "70%" : "10%" }}
          animate={reduce ? undefined : { left: k % 2 ? ["70%", "10%", "70%"] : ["10%", "70%", "10%"] }}
          transition={{
            duration: 7 + k * 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {["🐟", "🐠", "🐡"][k]}
        </motion.span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- n_back
export function NBackPlayer({ rounds, onDone }: PlayerProps<"n_back">) {
  return <NBackStream r={rounds[0]} onDone={onDone} />;
}

const YES = "yes";
const NO = "no";
/**
 * One picture at a time. The first n are only looked at; from then on, for each picture: "Is it the same as n
 * pictures ago?" (and, with places, "Is it in the same place?"). Yes / No, no clock.
 */
function NBackStream({ r, onDone }: { r: NBackRound; onDone: () => void }) {
  const ctx = usePlay();
  const t = useActT();
  const [i, setI] = useState(0);
  const questions = nBackQuestions(r);
  const total = r.n + questions.length;
  const nextItem = () => (i + 1 < r.seq.length ? setI(i + 1) : onDone());
  const stage = <NBackStage r={r} at={i} />;

  if (i < r.n)
    return (
      <Frame prompt={t("act.skill.nback.look")} speakKey={`look${i}`} done={i} total={total} action={<ActionButton label={t("act.next")} onSelect={nextItem} />}>
        {stage}
      </Frame>
    );
  const mine = questions.filter((q) => q.at === i);
  const before = r.n + questions.findIndex((q) => q.at === i);
  const optSize = fitSize(sizeFor(ctx, 120), 2);
  const specs = mine.map((q): ChoiceSpec => ({
    answer: q.yes ? YES : NO,
    options: [YES, NO],
    prompt: q.ask === "picture" ? (r.n === 1 ? t("act.skill.nback.same") : t("act.skill.nback.same.n", { n: r.n })) : r.n === 1 ? t("act.skill.nback.place") : t("act.skill.nback.place.n", { n: r.n }),
    stage,
    size: optSize,
    label: (id) => t(id === YES ? "act.skill.yes" : "act.skill.no"),
    art: (id, size) => (
      <span className="flex flex-col items-center gap-1">
        <span className="leading-none" style={{ fontSize: times(size, 0.36) }} aria-hidden>
          {id === YES ? "👍" : "✋"}
        </span>
        <span className="text-xl font-extrabold text-ink">{t(id === YES ? "act.skill.yes" : "act.skill.no")}</span>
      </span>
    ),
  }));
  return <ChoiceEngine key={i} rounds={specs} offset={before} total={total} onDone={nextItem} />;
}

/** The picture alone, or the picture in its cell of the 3×3 grid. */
function NBackStage({ r, at }: { r: NBackRound; at: number }) {
  const ctx = usePlay();
  if (!r.cells) return <PromptCard id={r.seq[at]} size={`min(${sizeFor(ctx, 150)}px, 22dvh)`} />;
  const cell = "min(64px, 7dvh, calc((100vw - 120px) / 3))";
  return (
    <div className="grid grid-cols-3 gap-1.5 rounded-fk-lg bg-surface-2 p-2 shadow-inner" aria-hidden>
      {Array.from({ length: 9 }, (_, c) => (
        <span key={c} className="grid place-items-center rounded-xl bg-surface" style={{ width: cell, height: cell }}>
          {r.cells![at] === c && <ItemArt id={r.seq[at]} size={times(cell, 0.7)} />}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- pairs_recall
export function PairsRecallPlayer({ rounds, onDone }: PlayerProps<"pairs_recall">) {
  const ctx = usePlay();
  const t = useActT();
  const r = rounds[0];
  const [q, setQ] = useState<number | "look">("look");
  const total = 1 + r.ask.length;
  if (q === "look") {
    const cell = fitSize(96, r.people.length > 4 ? 4 : r.people.length, 8, 72);
    return (
      <Frame prompt={t("act.skill.recall.look")} speakKey="look" done={0} total={total} action={<ActionButton label={t("act.ready")} onSelect={() => setQ(0)} />}>
        <div className={`grid gap-2 ${r.people.length > 4 ? "grid-cols-2 sm:grid-cols-4" : r.people.length > 2 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
          {r.people.map((p, k) => (
            <span key={k} className="flex items-center gap-1 rounded-2xl bg-surface-2 p-2 shadow-soft">
              <span
                className="grid place-items-center leading-none"
                style={{
                  width: cell,
                  height: cell,
                  fontSize: times(cell, 0.6),
                }}
                aria-hidden
              >
                {p}
              </span>
              <span className="grid place-items-center rounded-xl bg-surface" style={{ width: cell, height: cell }}>
                <ItemArt id={r.foods[k]} size={times(cell, 0.66)} />
              </span>
            </span>
          ))}
        </div>
      </Frame>
    );
  }
  const a = r.ask[q];
  const spec: ChoiceSpec = {
    answer: r.foods[a.person],
    options: a.options,
    prompt: t("act.skill.recall.ask"),
    size: denseSize(ctx, a.options.length, 120),
    stage: (
      <span
        className="grid place-items-center rounded-fk-lg bg-sun-soft/70 leading-none shadow-inner"
        style={{
          width: "min(140px, 16dvh)",
          height: "min(140px, 16dvh)",
          fontSize: "min(96px, 11dvh)",
        }}
        aria-hidden
      >
        {r.people[a.person]}
      </span>
    ),
  };
  return <ChoiceEngine key={q} rounds={[spec]} offset={1 + q} total={total} onDone={() => (q + 1 < r.ask.length ? setQ(q + 1) : onDone())} />;
}
