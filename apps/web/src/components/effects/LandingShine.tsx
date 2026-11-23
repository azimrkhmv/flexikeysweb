"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useCloudyMoves } from "@/features/parent/cloudyStore";

// B119 (Update 4 spec 8.3): the one Magic UI effect, a quiet shine around the landing page's main button. Sun and
// accent tokens only; one slow sweep, then a pause (globals.css `animate-shine`). Off with reduced motion and when
// "Cloudy moves" is off. Loaded after the page has loaded and the browser is idle (`ssr: false`), so it never slows the
// first paint. Nowhere else.

const ShineBorder = dynamic(() => import("./ShineBorder").then((m) => m.ShineBorder), { ssr: false });

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const m = matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useReducedMotion = () => useSyncExternalStore(subscribe, () => matchMedia(QUERY).matches, () => true);

export function LandingShine() {
  const moves = useCloudyMoves();
  const reduced = useReducedMotion();
  // Starts only when the page has loaded and the browser is idle, so it never competes with the first paint.
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const go = () => setIdle(true);
    const later = () => ("requestIdleCallback" in window ? requestIdleCallback(go, { timeout: 4000 }) : setTimeout(go, 2000));
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
    return () => window.removeEventListener("load", later);
  }, []);
  if (!moves || reduced || !idle) return null;
  return <ShineBorder borderWidth={2} duration={9} shineColor={["var(--sun)", "var(--accent)", "var(--sun)"]} />;
}
