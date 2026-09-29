"use client";

import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { usePlay } from "@/features/play/context";
import { Target } from "@/features/play/Target";
import { ActionButton, answer, Frame, sizeFor, useActT, useClock } from "./kit";
import type { EngineProps } from "./registry";

// Archetype C (Canvas & Guide): "Follow the path". Tap the next glowing stone, or trace along the
// path with a finger/mouse — tracing is optional, never required (design: no drags).

const W = 1000;
const H = 560;
type Shape = EngineProps<"path">["activity"]["shape"];

const tri = (u: number) => 1 - Math.abs((((u % 2) + 2) % 2) - 1);
const SHAPES: Record<Shape, (t: number) => [number, number]> = {
  wave: (t) => [100 + 800 * t, 280 + 150 * Math.sin(t * Math.PI * 2.5)],
  hill: (t) => [100 + 800 * t, 450 - 320 * Math.sin(Math.PI * t)],
  zigzag: (t) => [100 + 800 * t, 440 - 320 * tri(t * 4)],
  loop: (t) => {
    const a = Math.PI + t * Math.PI * 1.75;
    return [500 + 330 * Math.cos(a), 280 + 200 * Math.sin(a)];
  },
};

export function pathPoints(shape: Shape, mirror: boolean, n: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const [x, y] = SHAPES[shape](i / (n - 1));
    return [mirror ? W - x : x, y];
  });
}

const ROUNDS = [
  { mirror: false, stones: 6 },
  { mirror: true, stones: 6 },
  { mirror: false, stones: 8 },
];

export function Path({ activity, onDone }: EngineProps<"path">) {
  const [i, setI] = useState(0);
  const last = i + 1 >= ROUNDS.length;
  return <PathRound key={i} shape={activity.shape} {...ROUNDS[i]} index={i} last={last} next={() => (last ? onDone() : setI(i + 1))} />;
}

function PathRound({ shape, mirror, stones, index, last, next }: { shape: Shape; mirror: boolean; stones: number; index: number; last: boolean; next: () => void }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const box = useRef<HTMLDivElement>(null);
  const lastTrace = useRef(0);
  const [reached, setReached] = useState(0); // stone 0 = start, already reached
  const line = pathPoints(shape, mirror, 80);
  const pts = pathPoints(shape, mirror, stones);
  const d = `M${line.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`;
  const doneIdx = Math.round(((reached) / (stones - 1)) * (line.length - 1));
  const dDone = `M${line.slice(0, doneIdx + 1).map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`;
  const solved = reached >= stones - 1;
  const size = sizeFor(ctx, 80);

  const advance = (info: Parameters<typeof answer>[1]["info"]) => {
    if (solved) return;
    answer(ctx, { target: `stone${reached + 1}`, actual: `stone${reached + 1}`, correct: true, latencyMs: clock.ms(), info, quiet: reached + 2 < stones });
    clock.reset();
    setReached(reached + 1);
  };

  // Optional tracing: reaching the next stone within `traceTolerance` px counts as a step.
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (solved || !box.current || (e.pointerType !== "touch" && e.buttons !== 1)) return;
    const r = box.current.getBoundingClientRect();
    const [x, y] = pts[reached + 1];
    const dist = Math.hypot(e.clientX - (r.left + (x / W) * r.width), e.clientY - (r.top + (y / H) * r.height));
    if (e.timeStamp - lastTrace.current > 150) {
      lastTrace.current = e.timeStamp;
      ctx.emit({ type: "trace_point", levelId: ctx.levelId, activityId: ctx.activityId, offsetRatio: Math.round((dist / r.width) * 100) / 100, pointerType: e.pointerType as "touch" | "pen" | "mouse" });
    }
    // No offsetRatio: a trace is accepted anywhere inside the tolerance, so its distance says nothing about tap
    // precision. Reporting it made the engine read success as imprecision and widen help in a loop.
    if (dist <= ctx.profile.traceTolerance) advance({ pointerType: e.pointerType as "touch" | "pen" | "mouse" });
  };

  const [cx, cy] = pts[reached];
  return (
    <Frame
      prompt={t("act.path")}
      speakKey={`r${index}`}
      done={index + (solved ? 1 : 0)}
      total={ROUNDS.length}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      <div
        ref={box}
        onPointerMove={onMove}
        className="relative w-full max-w-4xl overflow-hidden rounded-fk-lg shadow-inner"
        style={{ aspectRatio: `${W} / ${H}`, touchAction: "none", background: "linear-gradient(180deg,#eef7ea 0%,#e1f1de 100%)" }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
          <text x="60" y="520" fontSize="40">🌼</text>
          <text x="880" y="80" fontSize="38">🌿</text>
          <text x="470" y="540" fontSize="34">🌸</text>
          <path d={d} fill="none" stroke="#f7f2e2" strokeWidth={Math.max(40, ctx.profile.traceTolerance * 1.2)} strokeLinecap="round" strokeLinejoin="round" />
          <path d={d} fill="none" stroke="#cdbf98" strokeWidth="5" strokeDasharray="16 14" strokeLinecap="round" />
          {reached > 0 && <path d={dDone} fill="none" stroke="#7fbf85" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
        {pts.map(([x, y], k) => {
          const isNext = k === reached + 1;
          const isEnd = k === stones - 1;
          const style = { left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` };
          const dot = (
            <span
              className={`block rounded-full border-4 border-white shadow-soft ${k <= reached ? "bg-leaf" : isEnd ? "bg-sun" : isNext ? "bg-sky" : "bg-surface"}`}
              style={{ width: size * 0.5, height: size * 0.5 }}
            />
          );
          return isNext && !solved ? (
            <Target
              key={k}
              label={t("act.stone", { n: k + 1 })}
              onSelect={advance}
              pulse
              className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
              style={{ ...style, width: size, height: size }}
            >
              {dot}
            </Target>
          ) : (
            <span key={k} className="absolute -translate-x-1/2 -translate-y-1/2" style={style} aria-hidden>
              {dot}
            </span>
          );
        })}
        <span
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[85%] text-5xl transition-all duration-500"
          style={{ left: `${(cx / W) * 100}%`, top: `${(cy / H) * 100}%` }}
          aria-hidden
        >
          ☁️
        </span>
      </div>
    </Frame>
  );
}
