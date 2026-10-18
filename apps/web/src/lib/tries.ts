import { LEVELS } from "@/content/levels";
import type { AccessMode, InteractionEvent } from "./types";

// The record of every try, as the spec writes it (§7, "How one try is recorded"). Built from the child shell's events,
// so every game gets it without its own code. A missed tap, a double tap or a hold released too early is an access
// event: outcome "skipped", never "wrong", and it never moves a skill level (product rule 5).

export interface TryRecord {
  id: string;
  ts: string;
  childId: string;
  sessionId: string;
  game: string;
  level: number;
  itemId: string;
  inputMode: "touch" | "dwell" | "switch" | "keyboard";
  outcome: "correct" | "wrong" | "skipped";
  /** This try's number on the item: 1 = first go; the count starts again after a correct answer. */
  attempts: number;
  hintShown: "none" | "shimmer" | "fade";
  accessEvent: boolean;
  helpedByAdult: boolean;
  /** Saved, never scored. */
  responseMs: number | null;
}

const ACTIVITY = new Map(LEVELS.flatMap((l) => l.activities.map((a) => [a.id, { game: a.kind, level: l.n }] as const)));

type Event = Omit<InteractionEvent, "sessionId">;
const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

/** One log per session: turns its events into try records, keeping the count of attempts and the last hint. */
export function createTryLog(s: { childId: string; sessionId: string; startedAt: number; access: AccessMode; helpedByAdult?: boolean }) {
  let attempts = 0;
  let hint: TryRecord["hintShown"] = "none";
  return (e: Event): TryRecord | null => {
    if (e.type === "hint_shown") {
      hint = hint === "none" ? "shimmer" : "fade";
      return null;
    }
    const access = e.type === "accidental_tap" || e.type === "debounced";
    if (!access && e.type !== "select" && e.type !== "key") return null;
    const where = ACTIVITY.get(e.activityId ?? "");
    const outcome = access ? "skipped" : e.correct === false ? "wrong" : "correct";
    const record: TryRecord = {
      id: newId(),
      ts: new Date(s.startedAt + e.t).toISOString(),
      childId: s.childId,
      sessionId: s.sessionId,
      game: where?.game ?? "unknown",
      level: where?.level ?? 0,
      itemId: e.target ?? e.activityId ?? "",
      inputMode: e.pointerType === "switch" ? "switch" : e.pointerType === "keyboard" ? "keyboard" : s.access === "dwell" ? "dwell" : "touch",
      outcome,
      attempts: access ? attempts + 1 : ++attempts,
      hintShown: hint,
      accessEvent: access,
      helpedByAdult: s.helpedByAdult ?? false,
      responseMs: e.latencyMs ?? null,
    };
    if (outcome === "correct") {
      attempts = 0;
      hint = "none";
    }
    return record;
  };
}
