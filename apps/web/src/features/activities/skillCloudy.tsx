"use client";

import { useReducedMotionConfig } from "motion/react";
import { useEffect, useState, type CSSProperties } from "react";
import { CloudShape, Cloudy, type CloudyForm } from "@/components/Cloudy";
import { usePlay } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";
import { afterMoves, cloudPlaces, cloudRows, type FindCloudyRound } from "@/lib/games/cloudy";
import { ActionButton, answer, Frame, useActT, useClock, useHint, useLater } from "./kit";
import { Series, useBox, type PlayerProps } from "./skillKit";

// Players of the Cloudy games (Warm Hills spec 15 Nov 2026, §6).

// ---------------------------------------------------------------- find_cloudy
/** The three animals of a session, one per round, each with its own move (spec §6.1). */
const ANIMALS = ["bunny", "fox", "cat"] as const satisfies readonly CloudyForm[];
/** Milliseconds: the first peek, one move (a swap or the jump), and one peek of the peek mode. */
const PEEK_MS = 1600;
const MOVE_MS = 900;
const PEEK_OUT_MS = 1100;

export function FindCloudyPlayer({ rounds, onDone }: PlayerProps<"find_cloudy">) {
  return <Series rounds={rounds} onDone={onDone} render={(r, i, next, last) => <CloudRound key={i} r={r} index={i} total={rounds.length} next={next} last={last} />} />;
}

/**
 * A small sky with clouds; Cloudy hides behind one. In "once" rounds he peeks, then the clouds swap (and once he
 * jumps): the child chooses only when the clouds are still, so switch scanning works, and nothing is timed after
 * that. The right cloud puffs away and Cloudy turns into an animal that shows its move; a wrong one wobbles softly,
 * after 2 the right cloud glows (the hint pulse), after 4 the others fade.
 */
function CloudRound({ r, index, total, next, last }: { r: FindCloudyRound; index: number; total: number; next: () => void; last: boolean }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const hint = useHint();
  const later = useLater();
  const reduce = !!useReducedMotionConfig();
  const { attach, w: sw, h: sh } = useBox();
  const moves = r.peek === "once" ? r.moves.length : 0;
  // 0: the first peek, 1…moves: after that many moves, moves + 1: the child chooses.
  const [stage, setStage] = useState(r.peek === "once" ? 0 : moves + 1);
  const [run, setRun] = useState(0); // "Show again"
  const [out, setOut] = useState(false); // peek mode: Cloudy out of his cloud for a moment
  const [solved, setSolved] = useState(false);
  const [wobble, setWobble] = useState({ cloud: -1, n: 0 });
  const picking = stage > moves;
  const animal = ANIMALS[index % ANIMALS.length];
  // With reduced motion the clouds do not glide: the two that swap are marked first, then change places at once.
  const moveMs = reduce ? 1400 : MOVE_MS;

  // The peek and the moves, one after another, then still.
  useEffect(() => {
    if (picking || r.peek !== "once") return;
    const id = setTimeout(() => setStage((s) => s + 1), stage === 0 ? PEEK_MS : moveMs);
    return () => clearTimeout(id);
  }, [stage, picking, r.peek, moveMs, run]);
  const shown = afterMoves(r, Math.min(stage, moves));
  const lastMove = stage >= 1 && stage <= moves ? r.moves[stage - 1] : null;
  const jumping = !!lastMove && "jump" in lastMove; // Cloudy is out while he goes to the other cloud
  const swapping = !!lastMove && "swap" in lastMove ? lastMove.swap : null;
  // Peek mode: out for a moment every few seconds, again and again, until he is found.
  useEffect(() => {
    if (r.peek !== "peek" || solved) return;
    let alive = true;
    const loop = (wait: number) =>
      later(() => {
        if (!alive) return;
        setOut(true);
        later(() => {
          if (!alive) return;
          setOut(false);
          loop(r.every * 1000);
        }, PEEK_OUT_MS);
      }, wait);
    loop(700);
    return () => void (alive = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.peek, r.every, solved]);
  useEffect(() => {
    if (picking) clock.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picking]);

  const right = shown.cloudy;
  const choose = (c: number, info: SelectInfo) => {
    if (!picking || solved) return;
    const correct = c === right;
    answer(ctx, { target: `cloud${right}`, actual: `cloud${c}`, correct, latencyMs: clock.ms(), info });
    if (correct) return setSolved(true);
    hint.miss();
    setWobble((w) => ({ cloud: c, n: w.n + 1 }));
  };
  const again = () => {
    setStage(0);
    setRun((x) => x + 1);
  };

  // Sizes from the measured sky. A tall sky (a phone) has fewer clouds a row, so each one stays big enough to press.
  const W = sw || 520;
  const H = sh || 390;
  const tall = H > W;
  const places = cloudPlaces(r.clouds, tall);
  const cw = Math.max(60, Math.min(170, (W * 0.8) / Math.max(...cloudRows(r.clouds, tall))));
  const ch = cw * 0.6;
  const cs = cw * 0.66; // Cloudy
  const px = (cloud: number) => {
    const [x, y] = places[shown.at[cloud]];
    return [(x / 100) * W, (y / 100) * H] as const;
  };
  const [cx, cy] = px(right);
  // "Show again" puts the clouds back at once; only the moves glide.
  const still = reduce || stage === 0;
  const visible = solved || out || jumping || r.peek === "stay" || (r.peek === "once" && stage === 0);

  const prompt = solved ? t(`act.skill.cloudy.${animal}`) : t(picking ? "act.skill.cloudy.pick" : "act.skill.cloudy.watch");
  return (
    <Frame
      prompt={prompt}
      speakKey={`cloudy${index}${solved ? "s" : picking ? "p" : "w"}${run}`}
      done={index + (solved ? 1 : 0)}
      total={total}
      action={
        solved ? (
          <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />
        ) : (
          r.peek === "once" &&
          picking && (
            <Target label={t("act.skill.cloudy.again")} onSelect={again} className="rounded-full bg-sky-soft px-8 text-lg font-extrabold text-ink shadow-soft">
              🔁 {t("act.skill.cloudy.again")}
            </Target>
          )
        )
      }
    >
      <div
        ref={attach}
        className="relative aspect-[3/4] w-[min(100%,calc(54dvh*3/4))] overflow-hidden rounded-fk-lg border-[1.5px] border-edge sm:aspect-[4/3] sm:w-[min(100%,46rem,calc(56dvh*4/3))]"
        style={{ background: "linear-gradient(180deg, var(--paper), var(--sky))" }}
      >
        {/* Cloudy, behind his cloud: half out, peeking, or out for the jump; found, he is an animal and moves. */}
        <span
          className="absolute left-0 top-0"
          style={{
            zIndex: solved ? 3 : 1,
            transition: still ? "none" : `transform ${MOVE_MS - 150}ms ease-in-out, opacity 300ms`,
            transform: `translate(${cx - cs / 2}px, ${cy - cs * (solved ? 1.1 : visible ? 1.2 : 0.5)}px)`,
            opacity: visible ? 1 : 0,
          }}
        >
          <span className={solved && !reduce ? `fk-cloudy-${animal}` : ""} style={{ display: "block", "--dx": cx > W / 2 ? -1 : 1, "--far": `${W * 0.32}px` } as CSSProperties}>
            <Cloudy size={cs} form={solved ? animal : "cloud"} face={solved ? "laugh" : "happy"} walk={solved && animal === "fox" && !reduce} />
          </span>
        </span>
        {Array.from({ length: r.clouds }, (_, c) => {
          const [x, y] = px(c);
          const rest = picking && hint.fade && c !== right && !solved;
          const marked = reduce && !!swapping && swapping.includes(c);
          return (
            <span
              key={c}
              className="absolute left-0 top-0"
              style={{ zIndex: 2, transition: still ? "none" : `transform ${MOVE_MS - 150}ms ease-in-out`, transform: `translate(${x - cw / 2}px, ${y - ch / 2}px)` }}
            >
              <Target
                label={t("act.skill.cloud", { n: c + 1 })}
                onSelect={(info) => choose(c, info)}
                disabled={!picking || solved || rest}
                scanSkip={!picking || solved || rest}
                pulse={picking && !solved && hint.show && c === right}
                className={`grid place-items-center rounded-full bg-transparent disabled:opacity-100 ${rest ? "opacity-25 disabled:opacity-25" : ""}`}
                style={{ width: cw, height: ch, minWidth: 60, minHeight: 40, boxShadow: marked ? "0 0 0 5px var(--sun)" : undefined }}
              >
                <span
                  key={wobble.cloud === c ? wobble.n : 0}
                  className={`block w-full ${wobble.cloud === c && wobble.n ? "fk-wobble" : ""}`}
                  style={{
                    transition: reduce ? "none" : "transform 500ms ease-out, opacity 500ms",
                    transform: solved && c === right ? "scale(1.5)" : undefined,
                    opacity: solved && c === right ? 0 : 1,
                  }}
                >
                  <CloudShape />
                </span>
              </Target>
            </span>
          );
        })}
      </div>
    </Frame>
  );
}
