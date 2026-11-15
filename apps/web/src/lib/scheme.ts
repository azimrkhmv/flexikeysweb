"use client";

import { useSyncExternalStore } from "react";

/**
 * The colour scheme (B99, 15 Nov 2026). "hills" (Warm Hills) is the default; the choice lives on this device only
 * (localStorage `fk-pal`), never on the server. The scheme is a `data-pal` attribute on <html>; globals.css holds
 * the colours. `SCHEME_SCRIPT` runs before the first paint so a saved scheme never flashes Warm Hills first.
 */
export const SCHEMES = ["hills", "sky", "mint", "lilac"] as const;
export type Scheme = (typeof SCHEMES)[number];
const KEY = "fk-pal";

/** Two colours per scheme for the round swatch in Account: the page tint and the button. */
export const SWATCH: Record<Scheme, [string, string]> = {
  hills: ["#FFE3B3", "#F08A3C"],
  sky: ["#DCE8FA", "#4A63C4"],
  mint: ["#CDEBDB", "#F9AE3F"],
  lilac: ["#E4D9F7", "#7352C4"],
};

export const SCHEME_SCRIPT = `try{var p=localStorage.getItem("${KEY}");if(p==="sky"||p==="mint"||p==="lilac")document.documentElement.dataset.pal=p}catch(e){}`;

const isScheme = (v: unknown): v is Scheme => SCHEMES.includes(v as Scheme);
const listeners = new Set<() => void>();
let current: Scheme | null = null;

function read(): Scheme {
  if (current) return current;
  let v: string | null = null;
  try {
    v = localStorage.getItem(KEY);
  } catch {
    /* blocked storage: Warm Hills */
  }
  current = isScheme(v) ? v : "hills";
  return current;
}

export function setScheme(s: Scheme) {
  current = s;
  if (s === "hills") delete document.documentElement.dataset.pal;
  else document.documentElement.dataset.pal = s;
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* blocked storage: the scheme holds until the page is closed */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** The scheme now; re-renders (and so repaints Cloudy) when it changes. */
export function useScheme(): Scheme {
  return useSyncExternalStore(subscribe, read, () => "hills" as Scheme);
}
