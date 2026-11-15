"use client";

import { useSyncExternalStore } from "react";

/**
 * "Cloudy moves: On / Off" (B102, spec 5.3), kept on this device (`fk-anim`). With `prefers-reduced-motion: reduce`
 * the switch starts Off. Also carries the "start the tour" request from Account to Cloudy, and whether the tour
 * was offered (`fk-tour`), so it is offered once.
 */
const KEY = "fk-anim";
const TOUR_KEY = "fk-tour";
const listeners = new Set<() => void>();
let moves: boolean | null = null;
let tourAsked = 0;

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function read(): boolean {
  if (moves !== null) return moves;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    /* blocked storage: the default */
  }
  moves = saved === "on" ? true : saved === "off" ? false : !reduced();
  return moves;
}

export function setCloudyMoves(on: boolean) {
  moves = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* blocked storage: holds until the page is closed */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useCloudyMoves = () => useSyncExternalStore(subscribe, read, () => false);

/** Account's "Show me around": Cloudy starts the tour (a counter, so asking twice works). */
export function askForTour() {
  tourAsked++;
  listeners.forEach((l) => l());
}
export const useTourAsked = () => useSyncExternalStore(subscribe, () => tourAsked, () => 0);

/** The tour is offered once per device: false once it was offered (or when nothing can be remembered). */
export function tourNotOffered(): boolean {
  try {
    return !localStorage.getItem(TOUR_KEY);
  } catch {
    return false; // no storage: never nag
  }
}
export function markTourOffered() {
  try {
    localStorage.setItem(TOUR_KEY, "1");
  } catch {
    /* nothing to remember with */
  }
}
