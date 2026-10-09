"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { pressDecision } from "@/lib/adaptive";
import { sfx, speak } from "@/lib/audio";
import type { Lang } from "@/lib/i18n";
import type { InteractionEvent } from "@/lib/types";
import { markAccept, usePlay } from "./context";

export interface SelectInfo {
  pointerType: InteractionEvent["pointerType"];
  offsetRatio?: number;
}

const HOVER_DWELL_MS = 1100;
/** Default scanning: 2 s per item — young children with CP rarely manage faster (iOS's 0.5 s default is far too fast). */
export const SCAN_DEFAULT = { stepMs: 2000, mode: "auto", speak: false } as const;

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
  scanSkip,
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
  /** Left out of switch scanning (e.g. fullscreen, sleeping levels) so a cycle reaches what matters sooner. */
  scanSkip?: boolean;
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
    runDwell((ctx.support?.hoverMs ?? HOVER_DWELL_MS) + ctx.profile.dwellMs, () => {
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
      data-scan-skip={scanSkip ? "" : undefined}
      className={`fk-target fk-dwell relative select-none ${pulse ? "fk-pulse" : ""} ${className}`}
      style={{ touchAction: "manipulation", ...style }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerLeave}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      // Pointer handlers own mouse/touch; click with detail 0 = keyboard or switch scanning.
      // Switches and keys get the same debounce as touch, so a tremor or clonus can't double-select.
      onClick={(e) => {
        if (e.detail !== 0 || disabled) return;
        const since = ctx.lastAccept.current === null ? null : performance.now() - ctx.lastAccept.current;
        if (pressDecision(Infinity, since, ctx.profile) === "debounced") ctx.emit({ type: "debounced", target: targetId, pointerType: "keyboard" });
        else fire({ pointerType: "keyboard" });
      }}
    >
      {children}
    </button>
  );
}

/**
 * Switch scanning: highlights each target in turn.
 * - auto (1 switch): moves every `stepMs`; Space or Enter selects.
 * - step (2 switches): Space moves to the next item, Enter selects — the child sets the pace.
 * `speak` reads each item aloud (auditory scanning, for children who can't see the highlight well or can't read).
 * After a selection the scan starts again from the first item.
 */
export function useScanning(
  enabled: boolean,
  root: { current: HTMLElement | null },
  opts: { stepMs: number; mode: "auto" | "step"; speak: boolean; lang: Lang } = { ...SCAN_DEFAULT, lang: "uz" },
) {
  const { stepMs, mode, speak: talk, lang } = opts;
  useEffect(() => {
    if (!enabled) return;
    let i = -1;
    let current: HTMLElement | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const targets = () => Array.from(root.current?.querySelectorAll<HTMLElement>("[data-fk-target]:not([disabled]):not([data-scan-skip])") ?? []);
    const step = () => {
      const list = targets();
      if (current) delete current.dataset.scanActive;
      if (!list.length) return;
      if (!current || !list.includes(current)) i = -1; // the screen changed: start from the top
      i = (i + 1) % list.length;
      current = list[i];
      current.dataset.scanActive = "true";
      current.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      if (talk) speak(current.getAttribute("aria-label") ?? "", lang);
    };
    const restart = () => {
      clearInterval(timer);
      if (mode === "auto") timer = setInterval(step, stepMs);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return; // a held switch auto-repeats ~30×/s: one press = one selection
      if (mode === "step" && e.key === " ") return step();
      current?.click();
      i = -1;
      if (current) delete current.dataset.scanActive;
      current = null;
      // Let the next screen render, then highlight its first item with a full step of time.
      setTimeout(() => {
        step();
        restart();
      }, 300);
    };
    step();
    restart();
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", onKey, true);
      if (current) delete current.dataset.scanActive;
    };
  }, [enabled, root, stepMs, mode, talk, lang]);
}
