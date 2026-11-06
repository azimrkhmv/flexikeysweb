"use client";

import { useEffect, useRef } from "react";

// The start of a section (B73): a full-screen layer in the banner's colour shows the banner's three texts, large and
// centred; after a moment they move and shrink into their places in the banner. Only transform and opacity animate,
// with the browser's own animations (no animation package in this project). The real banner, its texts hidden until
// the end, is what a screen reader reads: this layer is aria-hidden, and the wizard then moves focus to the title.

const HOLD_MS = 1200;
const MOVE_MS = 500;
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

export const wantsIntro = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** `data-to` names the banner element each text ends on. A tap, a click or any key skips to the end. */
export function SectionIntro({ number, title, intro, onMove, onDone }: { number: string; title: string; intro?: string; onMove: () => void; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = root.current!;
    const moves: Animation[] = [];
    const move = () => {
      onMove();
      layer.querySelectorAll<HTMLElement>("[data-to]").forEach((from) => {
        const to = document.getElementById(from.dataset.to!);
        if (!to) return;
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        const scale = parseFloat(getComputedStyle(to).fontSize) / parseFloat(getComputedStyle(from).fontSize);
        // Fades out on arrival while the banner's own text fades in, so a title that wraps differently never jumps.
        const end = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${scale})`;
        moves.push(from.animate([{ transform: "none", opacity: 1 }, { opacity: 1, offset: 0.6 }, { transform: end, opacity: 0 }], { duration: MOVE_MS, easing: EASE, fill: "forwards" }));
      });
      const background = layer.firstElementChild;
      if (background) moves.push(background.animate({ opacity: [1, 0] }, { duration: MOVE_MS, easing: EASE, fill: "forwards" }));
    };
    const moving = setTimeout(move, HOLD_MS);
    const done = setTimeout(onDone, HOLD_MS + MOVE_MS);
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && e.repeat) return;
      onDone();
    };
    // "click", not "pointerdown": a press would take the focus back from the title. On the next tick, so the click
    // that opened this section does not skip it.
    const listening = setTimeout(() => {
      window.addEventListener("click", skip);
      window.addEventListener("keydown", skip);
    });
    return () => {
      clearTimeout(moving);
      clearTimeout(done);
      clearTimeout(listening);
      moves.forEach((m) => m.cancel());
      window.removeEventListener("click", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [onMove, onDone]);

  return (
    <div ref={root} aria-hidden className="fixed inset-0 z-[60] grid place-items-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-teal-soft" />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <p data-to="section-number" className="origin-top-left text-xl font-bold text-ink-2">{number}</p>
        <p data-to="section-title" className="origin-top-left text-[clamp(2.25rem,11vw,4.5rem)] font-extrabold leading-tight text-ink [overflow-wrap:anywhere]">{title}</p>
        {intro && <p data-to="section-intro" className="origin-top-left text-xl text-ink-2">{intro}</p>}
      </div>
    </div>
  );
}
