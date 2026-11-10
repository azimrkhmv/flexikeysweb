"use client";

import { motion, useReducedMotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import { ItemArt, itemLabel } from "@/components/ItemArt";
import { usePlay } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";
import { dirOf, dirRot, FISH_MS, fishGrid, type OddOneOutRound, type TrackFishRound, type WhichWayRound } from "@/lib/games/attention";
import { glyph, glyphId } from "@/lib/games/glyph";
import { ChoiceEngine, type ChoiceSpec } from "./choice";
import { ActionButton, answer, denseSize, fitSize, Frame, useActT, useClock, useHint, useLater } from "./kit";
import { Series, useBox, type PlayerProps } from "./skillKit";

// Players of the new Attention games (games spec 8 Nov 2026, §6.1).

// ---------------------------------------------------------------- odd_one_out
/** Up to 16 pictures: one board of options. More (Summit has 36) do not fit a phone at a size a child can press, so
 *  the child first picks the row with the different one, then the picture in that row. */
export function OddOneOutPlayer({ rounds, onDone }: PlayerProps<"odd_one_out">) {
  const ctx = usePlay();
  const t = useActT();
  if (rounds[0].options.length <= 16) {
    const specs = rounds.map((r): ChoiceSpec => ({
      answer: r.odd,
      options: r.options,
      prompt: t("act.skill.odd"),
      size: denseSize(ctx, r.options.length),
    }));
    return <ChoiceEngine rounds={specs} onDone={onDone} />;
  }
  return <Series rounds={rounds} onDone={onDone} render={(r, i, next, last) => <OddRows key={i} r={r} index={i} total={rounds.length} next={next} last={last} />} />;
}

function OddRows({ r, index, total, next }: { r: OddOneOutRound; index: number; total: number; next: () => void; last: boolean }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const hint = useHint();
  const { attach, w: boxW, h: boxH } = useBox();
  const [row, setRow] = useState<number | null>(null);
  const perRow = Math.ceil(Math.sqrt(r.options.length));
  const rows = Array.from({ length: Math.ceil(r.options.length / perRow) }, (_, k) => r.options.slice(k * perRow, (k + 1) * perRow));
  const oddRow = Math.floor(r.options.indexOf(r.odd) / perRow);

  if (row !== null)
    return (
      <ChoiceEngine
        rounds={[
          {
            answer: r.odd,
            options: rows[row],
            prompt: t("act.skill.odd"),
            size: fitSize(110, 3),
          },
        ]}
        offset={index}
        total={total}
        onDone={next}
      />
    );

  // A row is at least 60 px high; its pictures fill it across.
  const rowH = Math.max(60, Math.min(84, Math.floor((boxH - (rows.length - 1) * 8) / rows.length) || 60));
  const pic = Math.max(28, Math.min(rowH - 14, Math.floor(((boxW || 600) - 24) / perRow) - 6));
  const pickRow = (k: number, info: SelectInfo) => {
    if (k === oddRow) return setRow(k); // the right row: on to the pictures (the try is the picture itself)
    answer(ctx, {
      target: `row${oddRow}`,
      actual: `row${k}`,
      correct: false,
      latencyMs: clock.ms(),
      info,
    });
    hint.miss();
  };
  return (
    <Frame prompt={t("act.skill.odd.row")} speakKey={`rows${index}`} done={index} total={total}>
      <div ref={attach} className="relative min-h-0 w-full max-w-3xl flex-1">
        <div className="absolute inset-0 flex flex-col justify-center gap-2">
          {rows.map((items, k) => {
            const rest = hint.fade && k !== oddRow;
            return (
              <Target
                key={k}
                label={t("act.skill.row", { n: k + 1 })}
                onSelect={(info) => pickRow(k, info)}
                pulse={hint.show && k === oddRow}
                disabled={rest}
                scanSkip={rest}
                className={`flex w-full items-center justify-around rounded-2xl border-4 border-transparent bg-surface-2 px-2 shadow-soft hover:bg-sky-soft ${rest ? "opacity-25" : ""}`}
                style={{ height: rowH }}
              >
                {items.map((id) => (
                  <ItemArt key={id} id={id} size={pic} />
                ))}
              </Target>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- track_fish
export function TrackFishPlayer({ rounds, onDone }: PlayerProps<"track_fish">) {
  return <Series rounds={rounds} onDone={onDone} render={(r, i, next, last) => <FishRound key={i} r={r} index={i} total={rounds.length} next={next} last={last} />} />;
}

/**
 * Some fish glow, then all swim and mix, then stop: only then can the child choose (so switch scanning works). After
 * 2 mistakes the right fish that are left glow again for a moment; after 4 the other fish fade.
 */
function FishRound({ r, index, total, next, last }: { r: TrackFishRound; index: number; total: number; next: () => void; last: boolean }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const hint = useHint();
  const later = useLater();
  const reduce = useReducedMotionConfig();
  const [cols, rows] = fishGrid(r.paths.length);
  const moves = r.paths[0].length - 1;
  const ms = FISH_MS[r.speed];
  const [stage, setStage] = useState(0); // 0 glowing at the start, 1…moves swimming, then picking
  const [found, setFound] = useState<number[]>([]);
  const [glowAgain, setGlowAgain] = useState(false);
  const picking = stage > moves;
  const left = r.glow.filter((f) => !found.includes(f));
  const solved = picking && !left.length;

  useEffect(() => {
    if (picking) return;
    const id = setTimeout(() => setStage((s) => s + 1), stage === 0 ? 2200 : ms);
    return () => clearTimeout(id);
  }, [stage, picking, ms]);
  useEffect(() => {
    if (picking) clock.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picking]);

  const tap = (f: number, info: SelectInfo) => {
    if (!picking || solved || found.includes(f)) return;
    const correct = r.glow.includes(f);
    answer(ctx, {
      target: `fish${left[0]}`,
      actual: `fish${f}`,
      correct,
      latencyMs: clock.ms(),
      info,
      quiet: correct && left.length > 1,
    });
    if (!correct) {
      hint.miss();
      if (hint.misses + 1 === 2) {
        setGlowAgain(true);
        later(() => setGlowAgain(false), 1500);
      }
      return;
    }
    clock.reset();
    setFound((x) => [...x, f]);
  };

  return (
    <Frame
      prompt={t(picking ? "act.skill.fish.pick" : "act.skill.fish.watch")}
      speakKey={`fish${index}${picking ? "p" : "w"}`}
      done={index + (solved ? 1 : 0)}
      total={total}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-fk-lg border border-line shadow-inner [container-type:size]"
        style={{
          width: "min(100%, 34rem, calc(46dvh * 4 / 3))",
          background: "linear-gradient(180deg,#cfe6fb 0%,#a9d2f2 70%,#e9dcb8 100%)",
        }}
      >
        {r.paths.map((path, f) => {
          const at = Math.min(stage, moves);
          const [x, y] = path[at];
          const facingRight = at > 0 && path[at][0] > path[at - 1][0];
          const glowing = (stage === 0 && r.glow.includes(f)) || (glowAgain && left.includes(f)) || found.includes(f);
          const rest = picking && hint.fade && !r.glow.includes(f);
          return (
            <motion.div
              key={f}
              className="absolute"
              initial={false}
              animate={{ left: `${x}%`, top: `${y}%` }}
              transition={{
                duration: reduce || stage <= 1 ? 0 : ms / 1000,
                ease: "easeInOut",
              }}
            >
              <Target
                label={t("act.skill.fish", { n: f + 1 })}
                onSelect={(info) => tap(f, info)}
                disabled={!picking || solved || rest}
                scanSkip={!picking || rest || found.includes(f)}
                selected={found.includes(f)}
                pulse={picking && hint.show && f === left[0] && !glowAgain}
                className={`grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition-[background,box-shadow,opacity] duration-300 disabled:opacity-100 ${rest ? "opacity-25 disabled:opacity-25" : ""}`}
                style={{
                  width: `min(84px, ${78 / cols}cqw, ${78 / rows}cqh)`,
                  height: `min(84px, ${78 / cols}cqw, ${78 / rows}cqh)`,
                  minWidth: 60,
                  minHeight: 60,
                  background: glowing ? "rgb(245 210 114 / .85)" : "transparent",
                  boxShadow: glowing ? "0 0 22px 8px rgb(245 210 114 / .6)" : undefined,
                }}
              >
                <span
                  className="leading-none"
                  style={{
                    fontSize: `min(48px, ${44 / cols}cqw, ${44 / rows}cqh)`,
                    transform: facingRight ? "scaleX(-1)" : undefined,
                  }}
                  aria-hidden
                >
                  🐟
                </span>
              </Target>
            </motion.div>
          );
        })}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- which_way
export function WhichWayPlayer({ rounds, onDone }: PlayerProps<"which_way">) {
  const ctx = usePlay();
  const t = useActT();
  const [specs] = useState(() =>
    rounds.map((r): ChoiceSpec => ({
      answer: r.answer,
      options: r.options,
      prompt: t(r.blue ? "act.skill.way.blue" : "act.skill.way"),
      size: denseSize(ctx, r.options.length, 120),
      label: (id) => t(`skill.dir.${dirOf(id)}`),
      stage: <Arrows r={r} />,
    })),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

/** The arrows in a row: the middle one bigger, green, or blue when the answer is the other way; the others pink. */
function Arrows({ r }: { r: WhichWayRound }) {
  const t = useActT();
  const n = r.flank * 2 + 1;
  const size = `min(72px, calc((100vw - 120px) / ${n}))`;
  const arrow = (k: number) => {
    const middle = k === r.flank;
    const d = middle ? r.dir : r.flankDir!;
    return (
      <ItemArt
        key={k}
        id={glyphId(
          glyph({
            shape: "arrow",
            color: middle ? (r.blue ? "blue" : "green") : "pink",
            rot: dirRot(d),
            size: middle ? 2 : 1,
          }),
        )}
        size={size}
      />
    );
  };
  return (
    <div className="flex items-center justify-center gap-1 rounded-fk-lg bg-surface-2 px-3 py-4 shadow-inner" role="img" aria-label={itemLabel(r.answer, "en", t)}>
      {Array.from({ length: n }, (_, k) => (
        <span key={k} className={k === r.flank ? `rounded-xl ${r.blue ? "ring-4 ring-sky" : ""}` : ""}>
          {arrow(k)}
        </span>
      ))}
    </div>
  );
}
