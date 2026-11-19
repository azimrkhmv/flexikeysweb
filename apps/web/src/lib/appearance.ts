"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DAY_SCHEMES, modeFor, SCHEMES, type Mode, type Scheme } from "./theme";

/**
 * How the site looks on this device (Update 3 spec 3, 4; 19 Nov 2026): a colour scheme, light or dark, and a style
 * (Soft or Sharp). Three attributes on <html>: `data-scheme`, `data-mode`, `data-style` (lib/theme.ts and
 * globals.css hold the colours and shapes). Kept in localStorage only (try/catch), never on the server.
 *
 * Parents and children choose separately. The parent's look (`fk-look`) is used on every page; a child's look
 * (`fk-look-child-<id>`: scheme and style, so siblings on one tablet keep their own) is used on that child's play
 * pages, with the parent's light or dark. A child who has not chosen gets the parent's scheme and Soft.
 * `APPEARANCE_SCRIPT` sets the attributes before the first paint, so a saved look never flashes the default first.
 */
export const STYLES = ["soft", "sharp"] as const;
export type Style = (typeof STYLES)[number];
export interface Look {
  scheme: Scheme;
  mode: Mode;
  style: Style;
}
export interface ParentLook extends Look {
  /** The last day scheme (not Night) the parent used: Light from Night goes back to it. */
  lastDay: Scheme;
}
export type ChildLook = Pick<Look, "scheme" | "style">;

import { KEY, OLD_KEY, PLAY_KEY } from "./appearanceScript";
const childKey = (id: string) => `fk-look-child-${id}`;
export const DEFAULT_LOOK: ParentLook = { scheme: "warm", mode: "light", style: "soft", lastDay: "warm" };

const isScheme = (v: unknown): v is Scheme => SCHEMES.includes(v as Scheme);
const isStyle = (v: unknown): v is Style => STYLES.includes(v as Style);

function load(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? v : null;
  } catch {
    return null; // blocked storage or a broken value: the default
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* blocked storage: the look holds until the page is closed */
  }
}

function readParentFromStorage(): ParentLook {
  const v = load(KEY) ?? {};
  if (!v.scheme) {
    try {
      const old = localStorage.getItem(OLD_KEY);
      if (old) v.scheme = old === "hills" ? "warm" : old;
    } catch {
      /* none */
    }
  }
  const scheme = isScheme(v.scheme) ? v.scheme : DEFAULT_LOOK.scheme;
  const lastDay = isScheme(v.lastDay) && v.lastDay !== "night" ? v.lastDay : scheme !== "night" ? scheme : DEFAULT_LOOK.lastDay;
  return { scheme, mode: v.mode === "dark" ? "dark" : "light", style: isStyle(v.style) ? v.style : DEFAULT_LOOK.style, lastDay };
}

// ---------------------------------------------------------------- the store

const listeners = new Set<() => void>();
let parent: ParentLook | null = null;
const children = new Map<string, ChildLook | null>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function readParent(): ParentLook {
  return (parent ??= readParentFromStorage());
}

/** The child's own choice, or null when the child has not chosen yet. */
function readChildChoice(id: string): ChildLook | null {
  if (!children.has(id)) {
    const v = load(childKey(id));
    children.set(id, v && isScheme(v.scheme) ? { scheme: v.scheme, style: isStyle(v.style) ? v.style : "soft" } : null);
  }
  return children.get(id)!;
}

/** What the child's play pages show: the child's choice, or the parent's scheme with Soft. */
export function readChild(id: string): ChildLook {
  const chosen = readChildChoice(id);
  if (chosen) return chosen;
  // The same object while the parent's scheme stays the same (useSyncExternalStore needs a stable snapshot).
  const scheme = readParent().scheme;
  let d = defaults.get(id);
  if (!d || d.scheme !== scheme) defaults.set(id, (d = { scheme, style: "soft" }));
  return d;
}
const defaults = new Map<string, ChildLook>();

// ---------------------------------------------------------------- putting a look on the page

/** Which look <html> shows now: the parent's, or a child's while a play page is open. */
let shown: { child: string | null } = { child: null };
let fadeTimer: ReturnType<typeof setTimeout> | undefined;

function paint(look: Look, fade: boolean) {
  const d = document.documentElement;
  const mode = modeFor(look.scheme, look.mode);
  if (d.dataset.scheme === look.scheme && d.dataset.mode === mode && d.dataset.style === look.style) return;
  if (fade && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    d.classList.add("fk-fade");
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => d.classList.remove("fk-fade"), 450);
  }
  d.dataset.scheme = look.scheme;
  d.dataset.mode = mode;
  d.dataset.style = look.style;
}

function repaint(fade: boolean) {
  const p = readParent();
  if (shown.child) {
    const c = readChild(shown.child);
    save(PLAY_KEY, c);
    paint({ ...c, mode: p.mode }, fade);
  } else paint(p, fade);
}

/** Change the parent's look (Account → Appearance). Applies at once, with a 0.4 s fade of the colours. */
export function setParentLook(patch: Partial<Look>) {
  const p = { ...readParent(), ...patch };
  if (p.scheme !== "night") p.lastDay = p.scheme;
  // Night is dark only: store it as dark, so the children's pages (which take the parent's light or dark) are dark too.
  else p.mode = "dark";
  parent = p;
  save(KEY, p);
  repaint(true);
  emit();
}

/**
 * Light or dark. Night has no light version, but Light is never disabled: from Night it goes back to the last day
 * scheme the parent used (Warm Hills if none), in light mode.
 */
export function setParentMode(mode: Mode) {
  const p = readParent();
  if (mode === "light" && p.scheme === "night") setParentLook({ scheme: DAY_SCHEMES.includes(p.lastDay) ? p.lastDay : "warm", mode: "light" });
  else setParentLook({ mode });
}

/** Change a child's look (My colours on the play home). */
export function setChildLook(id: string, patch: Partial<ChildLook>) {
  const c = { ...readChild(id), ...patch };
  children.set(id, c);
  save(childKey(id), c);
  repaint(true);
  emit();
}

/** The parent's look; re-renders when it changes. */
export function useParentLook(): ParentLook {
  return useSyncExternalStore(subscribe, readParent, () => DEFAULT_LOOK);
}

const SERVER_CHILD: ChildLook = { scheme: "warm", style: "soft" };
/** A child's look; re-renders when it changes. */
export function useChildLook(id: string): ChildLook {
  return useSyncExternalStore(
    subscribe,
    () => readChild(id),
    () => SERVER_CHILD,
  );
}

/** The look <html> shows now (parent's or child's), for drawings that need the mode. */
export function useShownLook(): Look {
  return useSyncExternalStore(
    subscribe,
    () => {
      const p = readParent();
      return shown.child ? lookCache(readChild(shown.child), p.mode) : p;
    },
    () => DEFAULT_LOOK,
  );
}
let lastLook: Look | null = null;
const lookCache = (c: ChildLook, mode: Mode): Look => {
  if (!lastLook || lastLook.scheme !== c.scheme || lastLook.style !== c.style || lastLook.mode !== mode) lastLook = { ...c, mode };
  return lastLook;
};

/**
 * While a child's play pages are open, the page shows that child's look; the parent's comes back when they close.
 * The parent's own pages never show the child's choice.
 */
export function usePlayLook(childId: string | null | undefined) {
  useEffect(() => {
    if (!childId) return;
    shown = { child: childId };
    repaint(false);
    emit();
    return () => {
      shown = { child: null };
      repaint(false);
      emit();
    };
  }, [childId]);
}
