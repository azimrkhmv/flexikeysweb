"use client";

import { useReducedMotionConfig } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { CloudShape, Cloudy, type CloudyForm } from "@/components/Cloudy";
import { usePlay } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";
import { afterMoves, cloudPlaces, cloudRows, GROW_FORMS, type FindCloudyRound, type GrowCloudyRound } from "@/lib/games/cloudy";
import { ActionButton, answer, Frame, useActT, useClock, useHint, useLater } from "./kit";
import { Series, useBox, type PlayerProps } from "./skillKit";
import { RAINBOW } from "@/content/pictureColors";

// Players of the Cloudy games (Warm Hills spec 15 Nov 2026, §6).

const noSubscribe = () => () => {};
/** Reduced motion, read only once the page runs in the browser: the server cannot know it, and a different first
 *  render would not match the page the server sent. */
function useReduce() {
  const reduce = useReducedMotionConfig();
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  return inBrowser && !!reduce;
}

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
  const reduce = useReduce();
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
            <Target label={t("act.skill.cloudy.again")} onSelect={again} className="rounded-full bg-tint px-8 text-lg font-extrabold text-ink shadow-soft">
              🔁 {t("act.skill.cloudy.again")}
            </Target>
          )
        )
      }
    >
      <div
        ref={attach}
        className="relative aspect-[3/4] w-[min(100%,calc(54dvh*3/4))] overflow-hidden rounded-fk-lg border-[1.5px] border-edge sm:aspect-[4/3] sm:w-[min(100%,46rem,calc(56dvh*4/3))]"
        style={{ background: "linear-gradient(180deg, var(--sky1), var(--sky2))" }}
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

// ---------------------------------------------------------------- grow_cloudy
export function GrowCloudyPlayer({ rounds, onDone }: PlayerProps<"grow_cloudy">) {
  return <Series rounds={rounds} onDone={onDone} render={(r, i, next, last) => <GrowRound key={i} r={r} index={i} total={rounds.length} next={next} last={last} />} />;
}

/** A raindrop (no outside art): the sky-blue drop of the drifting clouds, with an optional number on it. */
function Drop({ size, n }: { size: number; n?: number }) {
  return (
    <svg viewBox="0 0 40 52" width={size} height={size * 1.3} aria-hidden style={{ display: "block", overflow: "visible" }}>
      <path d="M20 2C20 2 4 22 4 33a16 16 0 0 0 32 0C36 22 20 2 20 2Z" fill="var(--accent)" stroke="var(--gameEdge)" strokeWidth="2.4" strokeLinejoin="round" />
      <ellipse cx="13" cy="31" rx="3.5" ry="6" fill="var(--paperSolid)" opacity=".7" transform="rotate(20 13 31)" />
      {n !== undefined && (
        <text x="20" y="40" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--ink)" fontFamily="var(--font-display)">
          {n}
        </text>
      )}
    </svg>
  );
}

/** The 8 places above Cloudy (x, y in % of the sky): 4 × 2 in a wide sky, 3 a row in a tall one. */
const growPlace = (cell: number, tall: boolean): [number, number] =>
  tall ? [20 + (cell % 3) * 30 + (Math.floor(cell / 3) % 2 ? 4 : -2), 21 + Math.floor(cell / 3) * 17] : [14 + (cell % 4) * 24 + (cell >= 4 ? 4 : -2), 27 + Math.floor(cell / 4) * 24];
/** Stars of the evening sky at the end (x, y in %). */
const STARS = [[12, 10], [26, 22], [44, 8], [62, 18], [78, 9], [90, 24], [8, 34], [70, 32]] as const;

/**
 * One growth stage: raindrops float above Cloudy; each one the child taps flies to him and he gulps it, and a row of
 * small drop marks fills. Full, he grows into the next animal (cloud → bunny → fox → bear → tiger). After the fourth
 * stage the tiger leaps, the sky turns to evening with stars and a rainbow, and the scene shakes a little — no sound.
 * Reduced motion: no leap, no shake, no evening; only the rainbow fades in.
 */
function GrowRound({ r, index, total, next, last }: { r: GrowCloudyRound; index: number; total: number; next: () => void; last: boolean }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const hint = useHint();
  const later = useLater();
  const reduce = useReduce();
  const { attach, w: sw, h: sh } = useBox();
  const n = r.drops.length;
  const [eaten, setEaten] = useState<number[]>([]);
  const [gone, setGone] = useState<number[]>([]); // leaves that floated away
  const [watching, setWatching] = useState(r.rule === "order"); // Summit: the numbers show first, then hide
  const [again, setAgain] = useState(false); // ... and again for a moment after the 2nd mistake
  const [grown, setGrown] = useState(false);
  const [gulp, setGulp] = useState(0);
  const [wobble, setWobble] = useState({ drop: -1, n: 0 });
  const rainbow = useRef<HTMLDivElement>(null);
  const ordered = r.rule === "size" || r.rule === "order";
  const want = ordered ? r.drops.findIndex((d) => d.rank === eaten.length + 1) : -1;
  const picking = !grown && !watching;
  const numbers = watching || again;
  const from = GROW_FORMS[index];
  const to = GROW_FORMS[index + 1];
  const ending = grown && to === "tiger";

  // Summit: the numbers show for a few seconds at the start, then hide; only then can the child choose.
  useEffect(() => {
    if (r.rule !== "order") return;
    const id = setTimeout(() => {
      setWatching(false);
      clock.reset();
    }, r.show * 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.rule, r.show]);
  // The end: the rainbow fades in, with reduced motion too (an animation of opacity only, set from here so the
  // reduced-motion rule that stops every CSS transition does not make it pop in).
  useEffect(() => {
    if (ending) rainbow.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1400, fill: "forwards", easing: "ease-out" });
  }, [ending]);

  const tapDrop = (k: number, info: SelectInfo) => {
    if (!picking || eaten.includes(k)) return;
    const correct = !ordered || k === want;
    const done = correct && eaten.length + 1 === n;
    answer(ctx, {
      target: `drop${ordered ? want : k}`,
      actual: `drop${k}`,
      correct,
      latencyMs: clock.ms(),
      info,
      quiet: correct && (!done || to === "tiger"), // praise when a stage is full; the ending itself has no sound
    });
    if (!correct) {
      hint.miss();
      setWobble((w) => ({ drop: k, n: w.n + 1 }));
      // Summit, from the 2nd mistake: the numbers show again for a moment.
      if (r.rule === "order" && hint.misses + 1 >= 2) {
        setAgain(true);
        later(() => setAgain(false), 1500);
      }
      return;
    }
    clock.reset();
    setEaten((x) => [...x, k]);
    later(() => setGulp((g) => g + 1), reduce ? 0 : 450);
    if (done) later(() => setGrown(true), reduce ? 300 : 900);
  };
  // A leaf is not a mistake: it just floats away (no try is saved).
  const tapLeaf = (k: number) => picking && setGone((x) => (x.includes(k) ? x : [...x, k]));

  const W = sw || 520;
  const H = sh || 390;
  const tall = H > W;
  const cell = Math.max(60, Math.min(96, (W * 0.84) / (tall ? 3 : 4)));
  const cloudyBase = Math.min(W, H) * (tall ? 0.34 : 0.3);
  const cs = cloudyBase * (1 + 0.1 * (index + (grown ? 1 : 0)));
  const [mx, my] = [W / 2, H * 0.97 - cs * 0.55]; // Cloudy's middle: where the drops fly
  const at = (c: number) => {
    const [x, y] = growPlace(c, tall);
    return [(x / 100) * W, (y / 100) * H] as const;
  };
  const prompt = grown
    ? t(`act.skill.grow.${to}`)
    : r.rule === "order" && !picking
      ? t("act.skill.grow.watch")
      : t(r.rule === "order" ? "act.skill.grow.order" : `act.skill.grow.${r.rule}`);

  return (
    <Frame
      prompt={prompt}
      speakKey={`grow${index}${grown ? "g" : picking ? "p" : "w"}`}
      done={index + (grown ? 1 : 0)}
      total={total}
      action={grown && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      <div
        ref={attach}
        className={`relative aspect-[3/4] w-[min(100%,calc(54dvh*3/4))] overflow-hidden rounded-fk-lg border-[1.5px] border-edge sm:aspect-[4/3] sm:w-[min(100%,46rem,calc(56dvh*4/3))] ${ending && !reduce ? "fk-shake" : ""}`}
        style={{ background: "linear-gradient(180deg, var(--sky1), var(--sky2))" }}
      >
        {/* The end: an evening sky with stars (not with reduced motion), and a rainbow. */}
        {ending && !reduce && (
          <div className="fk-evening absolute inset-0" aria-hidden>
            {STARS.map(([x, y], k) => (
              <span key={k} className="absolute text-lg leading-none text-sun" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${0.3 + k * 0.12}s` }}>
                ✦
              </span>
            ))}
          </div>
        )}
        {ending && (
          <div ref={rainbow} className="pointer-events-none absolute inset-x-0 top-[6%] flex justify-center" style={{ opacity: 0 }} aria-hidden>
            <svg viewBox="0 0 200 100" width="78%" style={{ overflow: "visible" }}>
              {RAINBOW.map((c, k) => (
                <path key={c} d={`M${20 + k * 9} 100a${80 - k * 9} ${80 - k * 9} 0 0 1 ${160 - k * 18} 0`} fill="none" stroke={c} strokeWidth="9" />
              ))}
            </svg>
          </div>
        )}
        {/* The drop marks: one for each drop of this stage, filled as Cloudy drinks (no number, spec §6.2). */}
        <div className="absolute inset-x-0 top-[3%] flex justify-center gap-1.5" aria-hidden>
          {r.drops.map((_, k) => (
            <span key={k} className="block transition-opacity duration-300" style={{ opacity: k < eaten.length ? 1 : 0.3 }}>
              <Drop size={16} />
            </span>
          ))}
        </div>
        {/* Cloudy at the bottom, a little bigger each stage. */}
        <span className="absolute left-0 top-0" style={{ zIndex: 1, transform: `translate(${mx - cs / 2}px, ${my - cs / 2}px)`, transition: reduce ? "none" : "transform 600ms ease-out" }}>
          <span key={gulp} className={`block ${gulp && !reduce ? "fk-gulp" : ""} ${ending && !reduce ? "fk-leap" : ""}`}>
            <Cloudy size={cs} form={grown ? to : from} face={grown ? "laugh" : eaten.length ? "wow" : "happy"} />
          </span>
        </span>
        {r.leaves.map((c, k) => {
          const [x, y] = at(c);
          const away = gone.includes(k) || grown; // the leaves left float away when Cloudy grows
          return (
            <span
              key={`l${k}`}
              className="absolute left-0 top-0"
              style={{ zIndex: 2, transform: `translate(${x - cell / 2}px, ${y - cell / 2 - (away ? H * 0.4 : 0)}px) rotate(${away ? 40 : 0}deg)`, opacity: away ? 0 : 1, transition: reduce ? "none" : "transform 900ms ease-in, opacity 900ms" }}
            >
              <Target label={t("act.skill.leaf", { n: k + 1 })} onSelect={() => tapLeaf(k)} disabled={!picking || away} scanSkip={!picking || away} className="grid place-items-center rounded-full bg-transparent disabled:opacity-100" style={{ width: cell, height: cell, minWidth: 60, minHeight: 60 }}>
                <span className="fk-float block leading-none" style={{ fontSize: cell * 0.55, animationDelay: `${-k * 0.7}s` }} aria-hidden>
                  🍃
                </span>
              </Target>
            </span>
          );
        })}
        {r.drops.map((d, k) => {
          const [x, y] = at(d.cell);
          const drunk = eaten.includes(k);
          const rest = picking && ordered && hint.fade && k !== want;
          const scale = r.rule === "size" ? 0.45 + (0.55 * (d.rank - 1)) / Math.max(1, n - 1) : 0.75;
          return (
            <span
              key={k}
              className="absolute left-0 top-0"
              style={{
                zIndex: 2,
                transform: drunk ? `translate(${mx - cell / 2}px, ${my - cell / 2}px) scale(0.2)` : `translate(${x - cell / 2}px, ${y - cell / 2}px)`,
                opacity: drunk ? 0 : 1,
                transition: reduce ? "none" : "transform 500ms ease-in, opacity 250ms 300ms",
              }}
            >
              <Target
                label={t("act.skill.drop", { n: k + 1 })}
                onSelect={(info) => tapDrop(k, info)}
                disabled={!picking || drunk || rest}
                scanSkip={!picking || drunk || rest}
                pulse={picking && hint.show && r.rule === "size" && k === want}
                className={`grid place-items-center rounded-full bg-transparent disabled:opacity-100 ${rest ? "opacity-25 disabled:opacity-25" : ""}`}
                style={{ width: cell, height: cell, minWidth: 60, minHeight: 60 }}
              >
                <span key={wobble.drop === k ? wobble.n : 0} className={`block ${wobble.drop === k && wobble.n ? "fk-wobble" : ""}`}>
                  <span className="fk-float block" style={{ animationDelay: `${-k * 0.9}s` }}>
                    <Drop size={cell * 0.62 * scale} n={r.rule === "order" && numbers ? d.rank : undefined} />
                  </span>
                </span>
              </Target>
            </span>
          );
        })}
      </div>
    </Frame>
  );
}
