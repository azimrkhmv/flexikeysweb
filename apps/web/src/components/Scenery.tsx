"use client";

import { useEffect } from "react";

/** Two drifting clouds and a few stars (stars only in dark sets: `--stars`, lib/theme.ts). */
function Sky({ stars }: { stars: [number, number][] }) {
  return (
    <>
      {stars.map(([l, t], k) => (
        <i key={k} className="fk-star" style={{ left: `${l}%`, top: `${t}%` }} />
      ))}
      {[
        ["6%", 0, 1],
        ["30%", -14, 0.7],
      ].map(([top, delay, s], k) => (
        <svg key={k} className="fk-vcloud" viewBox="0 0 120 70" style={{ top: top as string, animationDelay: `${delay}s`, width: 120 * (s as number) }}>
          <path d="M26 64C8 64 2 50 10 40C7 25 22 16 34 23C40 6 65 5 73 21C87 13 106 24 101 40C116 43 115 64 98 64Z" />
        </svg>
      ))}
    </>
  );
}

/**
 * Scenery (B100, B109, spec 6): the sun (the moon in dark sets: the same tokens), a far hill, two round hills, small
 * trees, drifting clouds and, in dark sets, a few stars; every colour from the scheme. Drawn in CSS (globals.css).
 * Decoration only. Used on the parent's first screen and as the foot of parent pages; never on a child's game screen.
 */
export function Vista() {
  return (
    <div className="fk-vista" data-fk-vista aria-hidden>
      <Sky stars={[[34, 10], [52, 22], [70, 8], [86, 26], [62, 34]]} />
      <div className="fk-sunny" />
      <div className="fk-hill fk-hill-far" />
      <div className="fk-hill fk-hill-a" />
      <div className="fk-hill fk-hill-b" />
      <div className="fk-tree" style={{ left: "16%", bottom: 86 }} />
      <div className="fk-tree fk-tree-s" style={{ left: "27%", bottom: 92 }} />
      <div className="fk-tree" style={{ right: "14%", bottom: 70 }} />
      <span className="fk-toy" style={{ "--d": 22, left: "8%", bottom: 16 } as React.CSSProperties}>
        <i className="fk-key">F</i>
      </span>
      <span className="fk-toy" style={{ "--d": -16, right: "30%", bottom: 12 } as React.CSSProperties}>
        <i className="fk-key" style={{ animationDelay: "-2s" }}>
          K
        </i>
      </span>
      <span className="fk-toy" style={{ "--d": 30, left: "40%", bottom: 30 } as React.CSSProperties}>
        <i className="fk-ring" style={{ animationDelay: "-1s" }} />
      </span>
      <span className="fk-toy" style={{ "--d": -26, right: "8%", bottom: 20 } as React.CSSProperties}>
        <i className="fk-block" style={{ animationDelay: "-3s" }} />
      </span>
    </div>
  );
}

export function Ground() {
  return (
    <div className="fk-ground print:hidden" aria-hidden>
      <div className="fk-hill fk-hill-far" />
      <div className="fk-hill fk-hill-a" />
      <div className="fk-hill fk-hill-b" />
      <div className="fk-tree" style={{ left: "12%", bottom: 96 }} />
      <div className="fk-tree fk-tree-s" style={{ left: "20%", bottom: 104 }} />
      <div className="fk-tree" style={{ right: "22%", bottom: 84 }} />
      <div className="fk-tree fk-tree-s" style={{ right: "10%", bottom: 70 }} />
    </div>
  );
}

/**
 * Small page effects (spec 3), mouse only and off with reduced motion: cards with the class `fk-tilt` lean up to 8°
 * toward the mouse with a soft light spot, and the toys in the scenery drift a little against the mouse.
 */
export function PageFx() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let last: HTMLElement | null = null;
    const clear = (el: HTMLElement) => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--go", "0");
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const vista = document.querySelector<HTMLElement>("[data-fk-vista]");
      if (vista) {
        vista.style.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3));
        vista.style.setProperty("--py", (e.clientY / innerHeight - 0.5).toFixed(3));
      }
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>(".fk-tilt") : null;
      if (last && last !== el) clear(last);
      last = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${((x - 0.5) * 8).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${((0.5 - y) * 8).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${x * 100}%`);
      el.style.setProperty("--gy", `${y * 100}%`);
      el.style.setProperty("--go", "0.5");
    };
    addEventListener("pointermove", move, { passive: true });
    return () => {
      removeEventListener("pointermove", move);
      if (last) clear(last);
    };
  }, []);
  return null;
}
