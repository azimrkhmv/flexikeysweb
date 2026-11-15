"use client";

import { useEffect } from "react";

/**
 * Warm Hills scenery (B100, spec 2.2): a pale sun, two round hills and small trees, drawn in CSS (globals.css) as
 * in the approved demo. Decoration only. Used on the parent's first screen and as the foot of parent pages; never
 * on a child's game screen.
 */
export function Vista() {
  return (
    <div className="fk-vista" data-fk-vista aria-hidden>
      <div className="fk-sunny" />
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
