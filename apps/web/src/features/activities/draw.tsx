"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { itemName, loadColoring, loadTrace, PALETTE, pathD, traceItems, type ColoringItem, type Pt, type TraceItem } from "@/content/drawing";
import { vocab } from "@/content/vocab";
import { usePlay } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";
import { ActionButton, answer, Frame, sizeFor, useActT, useClock } from "./kit";
import type { EngineProps } from "./registry";

// Drawing engines (PRD §9.7): trace, connect-the-dots, coloring, maze, finger paint. Same rule as every
// child activity: tapping always works — tracing/drawing with a finger is optional, never required —
// and nothing a child draws is ever "wrong". Content is the Flutter app's (src/content/drawing.ts).

const INK = "#4a4766";

function useLoaded<T>(load: () => Promise<T>): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    void load().then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [load]);
  return data;
}

function Loading() {
  return <div className="grid min-h-[480px] place-items-center" role="status" aria-busy="true"><span className="size-10 animate-spin rounded-full border-4 border-sky-soft border-t-sky" /></div>;
}

// ------------------------------------------------------------------ trace + connect-the-dots

export function Trace({ activity, onDone }: EngineProps<"trace">) {
  const ctx = usePlay();
  const data = useLoaded(loadTrace);
  const [i, setI] = useState(0);
  if (!data) return <Loading />;
  const items = traceItems(data, activity.set, ctx.learnLang, activity.items[ctx.learnLang]);
  const last = i + 1 >= items.length;
  return <DotRound key={i} mode="trace" item={items[i]} index={i} total={items.length} last={last} next={() => (last ? onDone() : setI(i + 1))} />;
}

export function Dots({ activity, onDone }: EngineProps<"dots">) {
  const data = useLoaded(loadTrace);
  const [i, setI] = useState(0);
  if (!data) return <Loading />;
  const items = activity.items.map((id) => data.objects.find((o) => o.id === id)).filter((o): o is TraceItem => !!o);
  const last = i + 1 >= items.length;
  return <DotRound key={i} mode="dots" item={items[i]} index={i} total={items.length} last={last} next={() => (last ? onDone() : setI(i + 1))} />;
}

const S = 1000; // viewBox of the square 0–1 canvas

function DotRound({ mode, item, index, total, last, next }: { mode: "trace" | "dots"; item: TraceItem; index: number; total: number; last: boolean; next: () => void }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const box = useRef<HTMLDivElement>(null);
  const lastTrace = useRef(0);
  const [reached, setReached] = useState(0); // dot 0 is the start
  const pts = item.dots.map(([x, y]) => [x * S, y * S] as Pt);
  const solved = reached >= pts.length - 1;
  const name = itemName(item, ctx.learnLang);
  const size = sizeFor(ctx, 80);

  const advance = (info: SelectInfo) => {
    if (solved) return;
    const finishing = reached + 2 >= pts.length;
    answer(ctx, { target: `dot${reached + 1}`, actual: `dot${reached + 1}`, correct: finishing || undefined, latencyMs: clock.ms(), info, quiet: !finishing });
    clock.reset();
    setReached(reached + 1);
    if (finishing && mode === "dots") ctx.say(name, ctx.learnLang); // the picture appears: say what it is
  };

  // Optional tracing: reaching the next dot within the adaptive tolerance counts as a step.
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (solved || !box.current || (e.pointerType !== "touch" && e.buttons !== 1)) return;
    const r = box.current.getBoundingClientRect();
    const [x, y] = pts[reached + 1];
    const dist = Math.hypot(e.clientX - (r.left + (x / S) * r.width), e.clientY - (r.top + (y / S) * r.height));
    if (e.timeStamp - lastTrace.current > 150) {
      lastTrace.current = e.timeStamp;
      ctx.emit({ type: "trace_point", levelId: ctx.levelId, activityId: ctx.activityId, offsetRatio: Math.round((dist / r.width) * 100) / 100, pointerType: e.pointerType as "touch" | "pen" | "mouse" });
    }
    if (dist <= ctx.profile.traceTolerance) advance({ pointerType: e.pointerType as "touch" | "pen" | "mouse" });
  };

  const done = `M${pts.slice(0, reached + 1).map(([x, y]) => `${x} ${y}`).join(" L")}`;
  const ghost = item.ghost.map((g) => pathD(g, false, false, S));
  const prompt = mode === "trace" ? t("act.trace", { x: name }) : t("act.dots");
  return (
    <Frame
      prompt={prompt}
      speak={mode === "trace" ? [[t("act.trace", { x: "" }), "ui"], [name, "learn"]] : undefined}
      speakKey={`${mode}${index}`}
      done={index + (solved ? 1 : 0)}
      total={total}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      <div
        ref={box}
        onPointerMove={onMove}
        className="relative aspect-square overflow-hidden rounded-fk-lg bg-[#fbf8ef] shadow-inner"
        style={{ touchAction: "none", width: "min(92vw, 30rem, 55dvh)" }}
      >
        <svg viewBox={`0 0 ${S} ${S}`} className="absolute inset-0 size-full" aria-hidden>
          {(mode === "trace" || solved) &&
            ghost.map((d, k) => (
              <path key={k} d={d} fill="none" stroke={solved ? "#7fbf85" : "#ece3c8"} strokeWidth={solved ? 34 : 70} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          {mode === "trace" && !solved && ghost.map((d, k) => <path key={`c${k}`} d={d} fill="none" stroke="#cdbf98" strokeWidth="5" strokeDasharray="16 14" strokeLinecap="round" />)}
          {reached > 0 && !solved && <path d={done} fill="none" stroke="#7fbf85" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
        {!solved &&
          pts.map(([x, y], k) => {
            const isNext = k === reached + 1;
            const style = { left: `${(x / S) * 100}%`, top: `${(y / S) * 100}%` };
            const dot = (
              <span
                className={`grid place-items-center rounded-full border-4 border-white text-sm font-extrabold shadow-soft ${k <= reached ? "bg-leaf text-white" : isNext ? "bg-sky text-white" : "bg-surface text-ink-2"}`}
                style={{ width: size * 0.5, height: size * 0.5 }}
              >
                {mode === "dots" ? k + 1 : ""}
              </span>
            );
            // Repeated waypoints (a stroke that returns) are drawn once, by the next one to reach.
            if (k > reached + 1 && pts.slice(reached + 1, k).some(([a, b]) => a === x && b === y)) return null;
            return isNext ? (
              <Target key={k} label={t("act.dot", { n: k + 1 })} onSelect={advance} pulse className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full" style={{ ...style, width: size, height: size }}>
                {dot}
              </Target>
            ) : (
              <span key={k} className="absolute -translate-x-1/2 -translate-y-1/2" style={style} aria-hidden>
                {dot}
              </span>
            );
          })}
        {solved && <p className="absolute inset-x-0 bottom-3 text-center text-3xl font-extrabold text-ink">{name}</p>}
      </div>
    </Frame>
  );
}

// ------------------------------------------------------------------ painting (coloring + finger paint)

type Stroke = { color: string; width: number; pts: Pt[] }; // pts in 0–1 of the board

/** A paint layer the child draws on with a finger/mouse, or taps to drop a blob. Strokes are kept so the
 *  canvas redraws crisply on resize and "undo" works. */
function usePaint() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  return {
    strokes,
    add: (s: Stroke) => setStrokes((xs) => [...xs, s]),
    extend: (p: Pt) => setStrokes((xs) => (xs.length ? [...xs.slice(0, -1), { ...xs[xs.length - 1], pts: [...xs[xs.length - 1].pts, p] }] : xs)),
    undo: () => setStrokes((xs) => xs.slice(0, -1)),
  };
}

function PaintLayer({ strokes, color, width, onStart, onExtend }: { strokes: Stroke[]; color: string; width: number; onStart: (s: Stroke) => void; onExtend: (p: Pt) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !box.w) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(box.w * dpr);
    c.height = Math.round(box.h * dpr);
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, box.w, box.h);
    g.lineCap = "round";
    g.lineJoin = "round";
    for (const s of strokes) {
      g.strokeStyle = g.fillStyle = s.color;
      g.lineWidth = s.width;
      const [x0, y0] = s.pts[0];
      if (s.pts.length === 1) {
        g.beginPath();
        g.arc(x0 * box.w, y0 * box.h, s.width * 1.6, 0, Math.PI * 2);
        g.fill();
        continue;
      }
      g.beginPath();
      g.moveTo(x0 * box.w, y0 * box.h);
      for (const [x, y] of s.pts.slice(1)) g.lineTo(x * box.w, y * box.h);
      g.stroke();
    }
  }, [strokes, box]);

  const at = (e: RPointerEvent): Pt => {
    const r = wrap.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  return (
    <div
      ref={wrap}
      className="absolute inset-0"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drawing.current = true;
        onStart({ color, width, pts: [at(e)] }); // a tap alone leaves a round blob
      }}
      onPointerMove={(e) => drawing.current && onExtend(at(e))}
      onPointerUp={() => (drawing.current = false)}
      onPointerCancel={() => (drawing.current = false)}
    >
      <canvas ref={canvas} className="size-full" aria-hidden />
    </div>
  );
}

function Palette({ color, onPick }: { color: string; onPick: (hex: string) => void }) {
  const ctx = usePlay();
  const size = Math.max(64, Math.round(68 * ctx.profile.targetScale));
  return (
    <div className="flex flex-wrap justify-center gap-2" role="group">
      {PALETTE.map((p) => (
        <Target
          key={p.id}
          label={vocab(p.id).word[ctx.uiLang]}
          onSelect={() => onPick(p.hex)}
          selected={color === p.hex}
          className={`rounded-full border-4 shadow-soft ${color === p.hex ? "border-ink" : "border-white"}`}
          style={{ width: size, height: size, background: p.hex }}
        >
          <span className="sr-only">{vocab(p.id).word[ctx.uiLang]}</span>
        </Target>
      ))}
    </div>
  );
}

/** Painting board + palette + undo / "paint for me" (for switch users) + done after a few marks. */
function PaintBoard({ aspect, art, prompt, speak, speakKey, onFinish }: { aspect: number; art?: ReactNode; prompt: string; speak?: [string, "learn" | "ui"][]; speakKey: string; onFinish: () => void }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const paint = usePaint();
  const [color, setColor] = useState(PALETTE[0].hex);
  const width = Math.round(22 * ctx.profile.targetScale); // Flutter's pen width, scaled by the profile
  const enough = paint.strokes.length >= 3;
  const forMe = () => {
    for (let k = 0; k < 5; k++) paint.add({ color, width, pts: [[0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6]] });
  };
  return (
    <Frame
      prompt={prompt}
      speak={speak}
      speakKey={speakKey}
      done={0}
      total={1}
      action={
        enough && (
          <ActionButton
            label={t("act.done")}
            pulse
            onSelect={() => {
              answer(ctx, { target: "artwork", actual: "artwork", correct: true, latencyMs: clock.ms() });
              onFinish();
            }}
          />
        )
      }
    >
      {/* Picture beside the controls on wide screens, above them on phones; its width also follows the
          screen height so the palette and Done stay in view without scrolling. */}
      <div className="flex flex-col items-center gap-4 lg:flex-row lg:gap-8">
        <div className="relative overflow-hidden rounded-fk-lg bg-white shadow-inner" style={{ aspectRatio: `${aspect}`, width: `min(92vw, 34rem, ${Math.round(55 * aspect)}dvh)` }}>
          <PaintLayer strokes={paint.strokes} color={color} width={width} onStart={paint.add} onExtend={paint.extend} />
          {art && <div className="pointer-events-none absolute inset-0">{art}</div>}
        </div>
        <div className="flex flex-col items-center gap-4 lg:max-w-56">
          <Palette color={color} onPick={setColor} />
          <div className="flex flex-wrap justify-center gap-3">
            <Target label={t("act.paint_for_me")} onSelect={forMe} className="rounded-full bg-sky-soft px-6 font-extrabold text-ink shadow-soft">
              ✨ {t("act.paint_for_me")}
            </Target>
            <Target label={t("act.undo")} onSelect={paint.undo} disabled={!paint.strokes.length} className="rounded-full bg-surface-2 px-6 font-extrabold text-ink shadow-soft disabled:opacity-40">
              ↩️ {t("act.undo")}
            </Target>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** Line art of a coloring picture as SVG (Flutter's paint models: ring, fill, fill with holes, stroke). */
export function ColoringArt({ item }: { item: ColoringItem }) {
  if (item.outline) {
    return (
      <svg viewBox={`0 0 ${S} ${S}`} className="size-full" aria-hidden>
        {item.outline.map((o, k) => (
          <path key={k} d={pathD(o, true, false, S)} fill="none" stroke={INK} strokeWidth="10" strokeLinejoin="round" />
        ))}
      </svg>
    );
  }
  const [w, h] = item.size!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="size-full" aria-hidden>
      {item.elements!.map((el, k) => {
        const smooth = el.smooth !== false;
        const d = pathD(el.points, el.closed, smooth);
        if (el.model === "stroke") return <path key={k} d={d} fill="none" stroke={INK} strokeWidth={el.width} strokeLinecap="round" strokeLinejoin="round" />;
        if (el.model === "ring") return <path key={k} d={`${d}${pathD(el.inner ?? [], true, smooth)}`} fill={INK} fillRule="evenodd" />;
        if (el.model === "fillWithHoles")
          return (
            <g key={k}>
              <path d={d} fill={INK} />
              {(el.holes ?? []).map((hole, j) => (
                <path key={j} d={pathD(hole, true, smooth)} fill="#fff" />
              ))}
            </g>
          );
        return <path key={k} d={d} fill={INK} />;
      })}
    </svg>
  );
}

export function Color({ activity, onDone }: EngineProps<"color">) {
  const ctx = usePlay();
  const t = useActT();
  const data = useLoaded(loadColoring);
  const [chosen, setChosen] = useState<ColoringItem | null>(null);
  if (!data) return <Loading />;
  const items = data[activity.set];
  if (!chosen) {
    // Like the Flutter coloring book: the child picks the picture first.
    const size = sizeFor(ctx, 150);
    return (
      <Frame prompt={t("act.color_pick")} speakKey="pick" done={0} total={1}>
        <div className="flex flex-wrap justify-center gap-4">
          {items.map((it) => (
            <Target key={it.id} label={it.names[ctx.learnLang]} onSelect={() => setChosen(it)} className="grid place-items-center rounded-fk-lg border-4 border-white bg-surface-2 p-3 shadow-soft hover:bg-sky-soft" style={{ width: size, height: size }}>
              <ColoringArt item={it} />
            </Target>
          ))}
        </div>
      </Frame>
    );
  }
  const name = chosen.names[ctx.learnLang];
  const [w, h] = chosen.size ?? [1, 1];
  return (
    <PaintBoard
      aspect={w / h}
      art={<ColoringArt item={chosen} />}
      prompt={t("act.color", { x: name })}
      speak={[[t("act.color", { x: "" }), "ui"], [name, "learn"]]}
      speakKey={`color-${chosen.id}`}
      onFinish={onDone}
    />
  );
}

export function Paint({ onDone }: EngineProps<"paint">) {
  const t = useActT();
  return <PaintBoard aspect={4 / 3} prompt={t("act.paint")} speakKey="paint" onFinish={onDone} />;
}

// ------------------------------------------------------------------ maze

type Cell = number; // r * n + c

/** Deterministic perfect maze (randomized depth-first search): every cell reachable, one way through. */
export function makeMaze(n: number, seed: number): Set<string> {
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const open = new Set<string>();
  const seen = new Set<Cell>([0]);
  const stack: Cell[] = [0];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const next = neighbors(n, cur).filter((x) => !seen.has(x));
    if (!next.length) {
      stack.pop();
      continue;
    }
    const pick = next[Math.floor(rnd() * next.length)];
    open.add(edge(cur, pick));
    seen.add(pick);
    stack.push(pick);
  }
  return open;
}

const edge = (a: Cell, b: Cell) => (a < b ? `${a}-${b}` : `${b}-${a}`);
function neighbors(n: number, c: Cell): Cell[] {
  const r = Math.floor(c / n);
  const k = c % n;
  return [r > 0 ? c - n : -1, r < n - 1 ? c + n : -1, k > 0 ? c - 1 : -1, k < n - 1 ? c + 1 : -1].filter((x) => x >= 0);
}

/** Cells on the way from `from` to the goal (for the hint and for telemetry). */
export function solve(n: number, open: Set<string>, from: Cell): Cell[] {
  const goal = n * n - 1;
  const prev = new Map<Cell, Cell>([[from, from]]);
  const queue = [from];
  while (queue.length) {
    const c = queue.shift()!;
    if (c === goal) break;
    for (const x of neighbors(n, c))
      if (open.has(edge(c, x)) && !prev.has(x)) {
        prev.set(x, c);
        queue.push(x);
      }
  }
  const way: Cell[] = [];
  for (let c = goal; c !== from; c = prev.get(c)!) way.unshift(c);
  return way;
}

const seedOf = (s: string) => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);

export function Maze({ activity, onDone }: EngineProps<"maze">) {
  const [i, setI] = useState(0);
  const [salt] = useState(() => Math.floor(Math.random() * 1e6)); // a new maze each visit
  const last = i + 1 >= activity.rounds;
  return <MazeRound key={i} n={activity.size} seed={seedOf(`${activity.id}:${i}:${salt}`)} index={i} total={activity.rounds} last={last} next={() => (last ? onDone() : setI(i + 1))} />;
}

function MazeRound({ n, seed, index, total, last, next }: { n: number; seed: number; index: number; total: number; last: boolean; next: () => void }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const open = useMemo(() => makeMaze(n, seed), [n, seed]);
  const [at, setAt] = useState<Cell>(0);
  const goal = n * n - 1;
  const solved = at === goal;
  const way = solve(n, open, at);

  const move = useCallback(
    (to: Cell, info: SelectInfo) => {
      if (solved || !open.has(edge(at, to))) return;
      // Exploring is never wrong: steps carry no `correct`, so wrong turns don't count as errors for accuracy/BKT.
      ctx.emit({ type: "select", levelId: ctx.levelId, activityId: ctx.activityId, target: `cell${way[0]}`, actual: `cell${to}`, latencyMs: clock.ms(), pointerType: info.pointerType });
      clock.reset();
      setAt(to);
      if (to === goal) answer(ctx, { target: "goal", actual: "goal", correct: true, latencyMs: 0, info });
    },
    [at, ctx, clock, goal, open, solved, way],
  );

  // Arrow keys move too (keyboard users).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (d === undefined || document.querySelector('[aria-modal="true"]')) return;
      if (e.repeat) return void e.preventDefault(); // held key = one step
      const to = at + d;
      if ((d === -1 && at % n === 0) || (d === 1 && at % n === n - 1) || to < 0 || to >= n * n) return;
      e.preventDefault();
      move(to, { pointerType: "keyboard" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, n, move]);

  const cell = 100 / n;
  const pos = (c: Cell) => ({ left: `${(c % n) * cell}%`, top: `${Math.floor(c / n) * cell}%`, width: `${cell}%`, height: `${cell}%` });
  const dirLabel = (to: Cell) => t(to === at - n ? "act.go_up" : to === at + n ? "act.go_down" : to === at - 1 ? "act.go_left" : "act.go_right");
  const walls: string[] = [];
  for (let c = 0; c < n * n; c++) {
    const r = Math.floor(c / n);
    const k = c % n;
    if (k < n - 1 && !open.has(edge(c, c + 1))) walls.push(`M${(k + 1) * 100} ${r * 100}V${(r + 1) * 100}`);
    if (r < n - 1 && !open.has(edge(c, c + n))) walls.push(`M${k * 100} ${(r + 1) * 100}H${(k + 1) * 100}`);
  }
  return (
    <Frame
      prompt={t("act.maze")}
      speakKey={`maze${index}`}
      done={index + (solved ? 1 : 0)}
      total={total}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      <div className="relative aspect-square rounded-fk-lg bg-[#eef7ea] shadow-inner" style={{ width: "min(92vw, 30rem, 55dvh)" }}>
        <svg viewBox={`-6 -6 ${n * 100 + 12} ${n * 100 + 12}`} className="absolute inset-0 size-full" aria-hidden>
          <rect x="0" y="0" width={n * 100} height={n * 100} fill="none" stroke="#6f8f72" strokeWidth="10" rx="8" />
          <path d={walls.join("")} stroke="#6f8f72" strokeWidth="10" strokeLinecap="round" />
        </svg>
        <span className="absolute grid place-items-center text-4xl" style={pos(goal)} aria-hidden>⭐</span>
        {!solved &&
          neighbors(n, at)
            .filter((to) => open.has(edge(at, to)))
            .map((to) => (
              <Target
                key={to}
                label={dirLabel(to)}
                onSelect={(info) => move(to, info)}
                pulse={ctx.profile.hintLevel >= 1 && way[0] === to}
                className="absolute grid place-items-center rounded-fk-lg bg-sky-soft/70"
                style={pos(to)}
              >
                <span className="text-2xl text-ink" aria-hidden>
                  {to === at - n ? "⬆️" : to === at + n ? "⬇️" : to === at - 1 ? "⬅️" : "➡️"}
                </span>
              </Target>
            ))}
        <span className="pointer-events-none absolute grid place-items-center text-5xl transition-all duration-300" style={pos(at)} aria-hidden>
          ☁️
        </span>
      </div>
    </Frame>
  );
}
