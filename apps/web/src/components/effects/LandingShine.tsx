"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { useCloudyMoves } from "@/features/parent/cloudyStore";

// B119 (Update 4 spec 8.3): the one Magic UI effect, a quiet shine around the landing page's main button. Sun and
// accent tokens only; one slow sweep, then a pause (globals.css `animate-shine`). Off with reduced motion and when
// "Cloudy moves" is off. Loaded after the page shows (`ssr: false`), so it never slows the first paint. Nowhere else.

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
  if (!moves || reduced) return null;
  return <ShineBorder borderWidth={2} duration={9} shineColor={["var(--sun)", "var(--accent)", "var(--sun)"]} />;
}
