import type { Lang } from "@/lib/i18n";
import type { ColoringSet, L10n, TraceSet } from "@/lib/types";

// Drawing content (PRD §9.6–9.7): the Flutter app's own trace strokes and coloring pictures, imported by
// scripts/import-flutter-drawing.py into ./drawing/*.json. Loaded on demand — only drawing activities
// download it, so the rest of the app doesn't grow.

export type Pt = [number, number];

/** A traceable glyph (label) or object (id + names), in the Flutter 0–1 canvas (content y≈0.15–0.87). */
export interface TraceItem {
  label?: string;
  id?: string;
  names?: L10n;
  /** Waypoints, visited in order. */
  dots: Pt[];
  /** Skeleton polylines drawn as the guide. */
  ghost: Pt[][];
}

export interface ColoringElement {
  model: "ring" | "fill" | "fillWithHoles" | "stroke";
  points: Pt[];
  inner?: Pt[];
  holes?: Pt[][];
  width?: number;
  closed: boolean;
  smooth?: false;
}

/** A coloring picture: detailed pixel-traced art (size + elements) or a legacy 0–1 outline. */
export interface ColoringItem {
  id: string;
  names: L10n;
  size?: Pt;
  elements?: ColoringElement[];
  outline?: Pt[][];
}

type TraceData = Record<"letters_latin" | "letters_cyrillic" | "numbers" | "objects", TraceItem[]>;
type ColoringData = Record<ColoringSet, ColoringItem[]>;

let traceData: Promise<TraceData> | null = null;
let coloringData: Promise<ColoringData> | null = null;
export const loadTrace = () => (traceData ??= import("./drawing/trace.json").then((m) => m.default as unknown as TraceData));
export const loadColoring = () => (coloringData ??= import("./drawing/coloring.json").then((m) => m.default as unknown as ColoringData));

/** Items of a trace set for the child's learning language (Cyrillic letters for Russian). */
export function traceItems(data: TraceData, set: TraceSet, lang: Lang, pick: readonly string[]): TraceItem[] {
  const pool = set === "letters" ? data[lang === "ru" ? "letters_cyrillic" : "letters_latin"] : data[set];
  const key = (it: TraceItem) => it.id ?? it.label ?? "";
  const chosen = pick.map((p) => pool.find((it) => key(it) === p || it.label === p)).filter((it): it is TraceItem => !!it);
  return chosen.length ? chosen : pool.slice(0, 3);
}

/** What the child hears/sees for an item: the glyph itself, or the object's name. */
export const itemName = (it: TraceItem | ColoringItem, lang: Lang) => ("names" in it && it.names ? it.names[lang] : (it as TraceItem).label ?? "");

const f = (n: number) => Math.round(n * 10) / 10;

/** SVG path data: Catmull-Rom smoothed (exactly the Flutter app's smoothPath) or straight. */
export function pathD(pts: readonly Pt[], closed: boolean, smooth = true, scale = 1): string {
  if (!pts.length) return "";
  const p = pts.map(([x, y]) => [x * scale, y * scale] as Pt);
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  if (!smooth || p.length < 3) {
    for (const [x, y] of p.slice(1)) d += `L${f(x)} ${f(y)}`;
    return closed ? `${d}Z` : d;
  }
  const n = p.length;
  const at = (i: number) => p[closed ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i))];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

/** Flutter's playful pen palette, named by the colors vocabulary (aria labels in the UI language). */
export const PALETTE: { id: string; hex: string }[] = [
  { id: "c_red", hex: "#ef6f6c" },
  { id: "c_orange", hex: "#f59e5b" },
  { id: "c_yellow", hex: "#f7cf4a" },
  { id: "c_green", hex: "#6cc082" },
  { id: "c_blue", hex: "#5b9be0" },
  { id: "c_purple", hex: "#a08be0" },
  { id: "c_pink", hex: "#f29bbd" },
];
