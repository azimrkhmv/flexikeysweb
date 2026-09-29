"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { pressDecision } from "@/lib/adaptive";
import { sfx } from "@/lib/audio";
import type { InteractionEvent } from "@/lib/types";
import { markAccept, usePlay } from "./context";

export interface SelectInfo {
  pointerType: InteractionEvent["pointerType"];
  offsetRatio?: number;
}

const HOVER_DWELL_MS = 1100;

/**
 * Every tappable thing in child mode. Supports the 4 input methods from the design:
 * touch/click (with adaptive hold-to-confirm + debounce), hover "waiting" (dwell), switch scanning
 * (via `data-fk-target`, driven by useScanning) and keyboard (Enter/Space).
 * No swipes, drags or double taps are ever required.
 */
export function Target({
  onSelect,
  children,
  label,
  className = "",
  style,
  disabled,
  targetId,
  pulse,
  selected,
}: {
  onSelect: (info: SelectInfo) => void;
  children: ReactNode;
  label: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  targetId?: string;
  /** Hint: gently pulse this target. */
  pulse?: boolean;
  selected?: boolean;
}) {
  const ctx = usePlay();
  const ref = useRef<HTMLButtonElement>(null);
  const down = useRef<{ t: number; type: SelectInfo["pointerType"]; offsetRatio?: number; accepted: boolean } | null>(null);
  const hoverDone = useRef(false);
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const setRing = (p: number) => {
    const el = ref.current;
    if (!el) return;
    if (p > 0) {
      el.dataset.dwell = "";
      el.style.setProperty("--dwell", String(Math.min(1, p)));
    } else delete el.dataset.dwell;
  };

  const fire = (info: SelectInfo) => {
    markAccept(ctx);
    sfx("tap");
    onSelect(info);
  };

  /** Time-based accept path shared by hold-to-confirm and hover dwell. */
  const runDwell = (ms: number, done: () => void) => {
    const start = performance.now();
    const tick = () => {
      const p = (performance.now() - start) / ms;
      setRing(p);
      if (p >= 1) {
        setRing(0);
        done();
      } else raf.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    cancelAnimationFrame(raf.current);
    setRing(0);
  };

  const onPointerDown = (e: RPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    const type = (e.pointerType || "mouse") as SelectInfo["pointerType"];
    down.current = { t: e.timeStamp, type, offsetRatio: Math.round((dist / Math.min(r.width, r.height)) * 100) / 100, accepted: false };
    const dwell = ctx.profile.dwellMs;
    if (dwell > 0)
      runDwell(dwell, () => {
        const d = down.current;
        if (!d) return;
        const since = ctx.lastAccept.current === null ? null : performance.now() - ctx.lastAccept.current;
        if (pressDecision(dwell, since, ctx.profile) === "debounced") {
          ctx.emit({ type: "debounced", target: targetId, pointerType: d.type });
          d.accepted = true;
          return;
        }
        d.accepted = true;
        fire({ pointerType: d.type, offsetRatio: d.offsetRatio });
      });
  };

  const onPointerUp = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = down.current;
    down.current = null;
    if (!d || disabled) return;
    stop();
    if (d.accepted) return;
    const since = ctx.lastAccept.current === null ? null : performance.now() - ctx.lastAccept.current;
    const result = pressDecision(e.timeStamp - d.t, since, ctx.profile);
    if (result === "accept") fire({ pointerType: d.type, offsetRatio: d.offsetRatio });
    else ctx.emit({ type: result === "debounced" ? "debounced" : "accidental_tap", target: targetId, pointerType: d.type });
  };

  const onPointerEnter = (e: RPointerEvent<HTMLButtonElement>) => {
    if (disabled || ctx.access !== "dwell" || e.pointerType === "touch" || hoverDone.current) return;
    runDwell(HOVER_DWELL_MS + ctx.profile.dwellMs, () => {
      hoverDone.current = true;
      fire({ pointerType: "mouse" });
    });
  };

  const onPointerLeave = () => {
    hoverDone.current = false;
    if (down.current && !down.current.accepted) down.current = null;
    stop();
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      data-fk-target=""
      className={`fk-target fk-dwell relative select-none ${pulse ? "fk-pulse" : ""} ${className}`}
      style={{ touchAction: "manipulation", ...style }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerLeave}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      // Pointer handlers own mouse/touch; click with detail 0 = keyboard or switch scanning.
      onClick={(e) => {
        if (e.detail === 0 && !disabled) fire({ pointerType: "keyboard" });
      }}
    >
      {children}
    </button>
  );
}

/** Switch scanning: highlights each target in turn; Space/Enter selects the highlighted one. */
export function useScanning(enabled: boolean, root: { current: HTMLElement | null }, stepMs = 1600) {
  useEffect(() => {
    if (!enabled) return;
    let i = -1;
    let current: HTMLElement | null = null;
    const targets = () => Array.from(root.current?.querySelectorAll<HTMLElement>("[data-fk-target]:not([disabled])") ?? []);
    const step = () => {
      const list = targets();
      if (current) delete current.dataset.scanActive;
      if (!list.length) return;
      i = (i + 1) % list.length;
      current = list[i];
      current.dataset.scanActive = "true";
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      current?.click();
    };
    step();
    const timer = setInterval(step, stepMs);
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", onKey, true);
      if (current) delete current.dataset.scanActive;
    };
  }, [enabled, root, stepMs]);
}
