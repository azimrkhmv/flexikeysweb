import type { AdaptiveProfile, ChildSupport, FloorKey, InteractionEvent, ParamKey, ProfileRecord } from "./types";

// Client mirror of the server adaptive engine (PRD §9.5). The real engine runs in the
// backend worker; this copy powers the demo and documents the rules the UI relies on.

export const DEFAULT_PROFILE: AdaptiveProfile = {
  keyScale: 1,
  spacing: 8,
  dwellMs: 0,
  debounceMs: 250,
  hintLevel: 1,
  optionCount: 3,
  targetScale: 1,
  traceTolerance: 40,
  breakAfterMin: 15,
};

/** [min, max, step] — every change is exactly one step (FR-ADAPT-3). */
export const BOUNDS: Record<ParamKey, [number, number, number]> = {
  keyScale: [1, 1.6, 0.1],
  spacing: [4, 20, 4],
  dwellMs: [0, 600, 150],
  debounceMs: [150, 600, 75],
  hintLevel: [0, 3, 1],
  optionCount: [2, 4, 1],
  targetScale: [1, 1.4, 0.1],
  traceTolerance: [24, 72, 8],
  breakAfterMin: [8, 20, 3],
};

/**
 * First profile for a new child from the parent-reported levels, so a child with severe motor or vision
 * difficulties doesn't start on the defaults and wait sessions for help. The engine adapts from here.
 */
export function startingProfile(s?: ChildSupport): AdaptiveProfile {
  const p = { ...DEFAULT_PROFILE };
  const hands = s?.macs ?? 1;
  if (hands >= 4) Object.assign(p, { keyScale: 1.3, targetScale: 1.3, spacing: 12, dwellMs: 300, debounceMs: 450, traceTolerance: 56 });
  else if (hands === 3) Object.assign(p, { keyScale: 1.2, targetScale: 1.2, spacing: 12, dwellMs: 150, debounceMs: 375, traceTolerance: 48 });
  if ((s?.vfcs ?? 1) >= 3) Object.assign(p, { targetScale: 1.4, keyScale: Math.max(p.keyScale, 1.3), optionCount: 2 });
  if ((s?.cfcs ?? 1) >= 4) p.hintLevel = 2;
  return withFloors(p, s?.floors);
}

/** Raises params to the adult-set minimums. */
export function withFloors(p: AdaptiveProfile, floors?: Partial<Record<FloorKey, number>>): AdaptiveProfile {
  if (!floors) return p;
  const out = { ...p };
  for (const [k, v] of Object.entries(floors) as [FloorKey, number][]) if (typeof v === "number") out[k] = Math.max(out[k], v);
  return out;
}

/** Sessions during which the opposite direction stays blocked. Expires — no ratchet (fixes B5). */
export const HYSTERESIS_SESSIONS = 2;
const MIN_EVENTS = 8;

export interface SessionMetrics {
  taps: number;
  accuracy: number;
  accidentalRate: number;
  debounceRate: number;
  offsetRatio: number | null; // null when no touch/pen geometry
  avgLatencyMs: number;
  fatigue: boolean;
}

export function computeMetrics(events: InteractionEvent[]): SessionMetrics {
  const answers = events.filter((e) => (e.type === "select" || e.type === "key") && e.correct !== undefined);
  const accidental = events.filter((e) => e.type === "accidental_tap").length;
  const debounced = events.filter((e) => e.type === "debounced").length;
  const presses = answers.length + accidental + debounced;
  const correct = answers.filter((e) => e.correct).length;
  // Geometry only from touch/pen — mouse and keyboard feed accuracy/latency only (PRD §9.5.2).
  const geo = answers.filter((e) => e.offsetRatio !== undefined && (e.pointerType === "touch" || e.pointerType === "pen"));
  const lat = answers.map((e) => e.latencyMs ?? 0).filter((l) => l > 0);
  const third = Math.max(1, Math.floor(lat.length / 3));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    taps: presses,
    accuracy: answers.length ? correct / answers.length : 1,
    accidentalRate: presses ? accidental / presses : 0,
    debounceRate: presses ? debounced / presses : 0,
    offsetRatio: geo.length ? avg(geo.map((e) => e.offsetRatio!)) : null,
    avgLatencyMs: avg(lat),
    fatigue: lat.length >= 9 && avg(lat.slice(-third)) > 1.4 * avg(lat.slice(0, third)),
  };
}

/**
 * Desired direction per param: +1 = more help, -1 = less help, 0 = keep.
 * Motor help (sizes, spacing, tolerance) follows motor signals only; learning help (hints, options) follows
 * accuracy only. Mixing them grew keys for wrong answers and shrank them for a child who knows the answers
 * but struggles to hit them.
 */
function wants(m: SessionMetrics): Partial<Record<ParamKey, 1 | -1>> {
  const w: Partial<Record<ParamKey, 1 | -1>> = {};

  if (m.accidentalRate > 0.15) w.dwellMs = 1;
  else if (m.accidentalRate < 0.03) w.dwellMs = -1;

  if (m.debounceRate > 0.1) w.debounceMs = 1;
  else if (m.debounceRate < 0.02) w.debounceMs = -1;

  // Sizes only move with touch/pen geometry; keyboard and switch users keep theirs.
  if (m.offsetRatio !== null) {
    if (m.offsetRatio > 0.35 || m.accidentalRate > 0.15) {
      w.keyScale = 1;
      w.targetScale = 1;
      w.traceTolerance = 1;
    } else if (m.offsetRatio < 0.2 && m.accidentalRate < 0.03) {
      w.keyScale = -1;
      w.targetScale = -1;
      w.traceTolerance = -1;
    }
    if (m.offsetRatio > 0.35) w.spacing = 1;
    else if (m.offsetRatio < 0.15) w.spacing = -1;
  }

  if (m.accuracy < 0.6) {
    w.hintLevel = 1;
    w.optionCount = 1; // more help → fewer choices (see HELP_IS_LOWER)
  } else if (m.accuracy >= 0.9 && m.avgLatencyMs < 3000) {
    w.hintLevel = -1;
    w.optionCount = -1;
  }

  if (m.fatigue) w.breakAfterMin = 1; // more help → earlier break
  else if (m.accuracy >= 0.8) w.breakAfterMin = -1;
  return w;
}

// For optionCount / breakAfterMin "more help" means a lower number.
const HELP_IS_LOWER: ParamKey[] = ["optionCount", "breakAfterMin"];

export interface PolicyChange {
  param: ParamKey;
  from: number;
  to: number;
  reasonKey: string;
}

export function applyPolicy(rec: ProfileRecord, events: InteractionEvent[], floors?: ChildSupport["floors"]): { record: ProfileRecord; changes: PolicyChange[] } {
  const m = computeMetrics(events);
  // Age out hysteresis every session so it can never ratchet.
  const lastDir: ProfileRecord["lastDir"] = {};
  for (const [k, v] of Object.entries(rec.lastDir) as [ParamKey, { dir: 1 | -1; left: number }][]) {
    if (v.left > 1) lastDir[k] = { dir: v.dir, left: v.left - 1 };
  }
  if (m.taps < MIN_EVENTS) return { record: { ...rec, lastDir }, changes: [] };

  const params = { ...rec.params };
  const changes: PolicyChange[] = [];
  for (const [param, help] of Object.entries(wants(m)) as [ParamKey, 1 | -1][]) {
    const [bound, max, step] = BOUNDS[param];
    const min = Math.max(bound, floors?.[param as FloorKey] ?? bound);
    const valueDir = HELP_IS_LOWER.includes(param) ? -help : help;
    const blocked = rec.lastDir[param];
    if (blocked && blocked.left > 0 && blocked.dir !== valueDir) continue;
    const from = params[param];
    const to = Math.round(Math.min(max, Math.max(min, from + valueDir * step)) * 100) / 100;
    if (to === from) continue;
    params[param] = to;
    lastDir[param] = { dir: valueDir as 1 | -1, left: HYSTERESIS_SESSIONS };
    changes.push({ param, from, to, reasonKey: `adapt.${param}.${help > 0 ? "more" : "less"}` });
  }
  return {
    record: { ...rec, params, lastDir, version: rec.version + (changes.length ? 1 : 0), updatedAt: new Date().toISOString() },
    changes,
  };
}

/** Bayesian Knowledge Tracing update (simplified: slip 0.1, guess 0.2, learn 0.15). */
export function bkt(pKnown: number, correct: boolean): number {
  const slip = 0.1, guess = 0.2, learn = 0.15;
  const post = correct
    ? (pKnown * (1 - slip)) / (pKnown * (1 - slip) + (1 - pKnown) * guess)
    : (pKnown * slip) / (pKnown * slip + (1 - pKnown) * (1 - guess));
  return Math.min(0.99, post + (1 - post) * learn);
}

export type PressResult = "accept" | "accidental" | "debounced";

/**
 * Keyboard/target timing rule (FR-KBD-2, FR-KBD-3).
 * `heldMs` = how long the pointer was down; `sinceLastAccept` = ms from the previous accepted press.
 */
export function pressDecision(heldMs: number, sinceLastAccept: number | null, p: Pick<AdaptiveProfile, "dwellMs" | "debounceMs">): PressResult {
  if (sinceLastAccept !== null && sinceLastAccept < p.debounceMs) return "debounced";
  if (heldMs < p.dwellMs) return "accidental";
  return "accept";
}
