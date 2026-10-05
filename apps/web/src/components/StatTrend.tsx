"use client";

import Link from "next/link";
import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export interface TrendPoint {
  /** Shown in the tooltip and the screen-reader list, e.g. "3 Oct". */
  label: string;
  value: number;
}

/**
 * Stat tile: label / period, the value, a comparison with the previous period and an optional sparkline.
 * The sparkline is one series in the primary colour (≥ 3:1 on the surface); a crosshair snaps to the nearest
 * day on hover, and arrow keys move it when the chart has focus. Every value is also in a visually hidden list.
 */
export function StatTrend({
  label,
  period,
  value,
  delta,
  series,
  days,
  href,
  hrefLabel,
}: {
  label: string;
  period?: string;
  value: string | number;
  /** Text like "+12 vs last week"; `dir` picks the arrow. */
  delta?: { text: string; dir: 1 | 0 | -1 };
  series?: TrendPoint[];
  /** Instead of a sparkline: one dot per day, filled when it counts (e.g. "played"). */
  days?: { label: string; on: boolean }[];
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="relative flex flex-col rounded-fk border border-line bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-ink">
          {label}
          {period && <span className="font-semibold text-muted"> / {period}</span>}
        </p>
        {href && (
          <Link href={href} aria-label={hrefLabel ?? label} className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 transition hover:bg-primary-soft hover:text-primary">
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      <div className="mt-2 text-3xl font-extrabold text-ink">{value}</div>
      {delta && (
        <p className="mt-1 flex items-center gap-1 text-sm text-muted">
          {delta.dir > 0 ? <ArrowUpRight className="size-4" aria-hidden /> : delta.dir < 0 ? <ArrowDownRight className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
          {delta.text}
        </p>
      )}
      {series && series.length > 1 && (
        <div className="mt-auto">
          <Sparkline series={series} name={label} />
        </div>
      )}
      {days && (
        <ul className="mt-auto flex justify-between gap-1 pt-4" aria-label={label}>
          {days.map((d) => (
            <li key={d.label} title={d.label} className={`h-10 flex-1 rounded-md ${d.on ? "bg-primary" : "bg-surface-2"}`}>
              <span className="sr-only">
                {d.label}: {d.on ? "✓" : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const H = 40;

function Sparkline({ series, name }: { series: TrendPoint[]; name: string }) {
  const [at, setAt] = useState<number | null>(null);
  const n = series.length;
  const max = Math.max(1, ...series.map((p) => p.value));
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => H - 3 - (v / max) * (H - 8);
  const line = series.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAt(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setAt((i) => Math.max(0, Math.min(n - 1, (i ?? n - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
  };
  const dot = (i: number, cls: string) => (
    <span className={`pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface ${cls}`} style={{ left: `${x(i)}%`, top: y(series[i].value) }} aria-hidden />
  );

  return (
    <div
      className="relative mt-4 h-10 cursor-crosshair rounded-md"
      tabIndex={0}
      role="img"
      aria-label={`${name}: ${series.map((p) => `${p.label} ${p.value}`).join(", ")}`}
      onPointerMove={pick}
      onPointerLeave={() => setAt(null)}
      onFocus={() => setAt(n - 1)}
      onBlur={() => setAt(null)}
      onKeyDown={onKey}
    >
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden>
        <polygon points={`0,${H} ${line} 100,${H}`} fill="var(--fk-primary-soft)" />
        <polyline points={line} fill="none" stroke="var(--fk-primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {at === null ? (
        dot(n - 1, "bg-primary")
      ) : (
        <>
          <span className="pointer-events-none absolute inset-y-0 w-px bg-ink-2/40" style={{ left: `${x(at)}%` }} aria-hidden />
          {dot(at, "bg-primary")}
          <span
            className="pointer-events-none absolute bottom-full mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-white shadow-lift"
            style={{ left: `clamp(2rem, ${x(at)}%, calc(100% - 2rem))` }}
            aria-hidden
          >
            <strong className="font-extrabold">{series[at].value}</strong> <span className="opacity-80">{series[at].label}</span>
          </span>
        </>
      )}
    </div>
  );
}
