"use client";

import { createContext, useContext } from "react";
import { DEFAULT_PROFILE } from "@/lib/adaptive";
import { sfx, speak } from "@/lib/audio";
import type { Lang } from "@/lib/i18n";
import type { AccessMode, AdaptiveProfile, InteractionEvent } from "@/lib/types";

export type PlayEvent = Omit<InteractionEvent, "sessionId" | "t">;

/** Everything an activity engine needs from the child shell. Engines only take `{activity, onDone}` as props. */
export interface PlayCtx {
  childName: string;
  profile: AdaptiveProfile;
  access: AccessMode;
  /** Language of words/letters being learned. */
  learnLang: Lang;
  /** Language of instructions, mascot lines and AAC. */
  uiLang: Lang;
  levelId?: string;
  activityId?: string;
  /** Telemetry → batched to POST /sessions/{id}/events. */
  emit(e: PlayEvent): void;
  /** Mascot + sound reaction. "try" is the gentle, never-negative response to a miss. */
  react(kind: "success" | "try"): void;
  say(text: string, lang?: Lang, queue?: boolean): void;
  /** Shared across all targets for debounce. */
  lastAccept: { current: number | null };
}

const demoLastAccept = { current: null as number | null };

/** Used outside the child shell (e.g. marketing demo): no data is stored. */
export const DEMO_PLAY: PlayCtx = {
  childName: "",
  profile: DEFAULT_PROFILE,
  access: "touch",
  learnLang: "uz",
  uiLang: "uz",
  emit: () => {},
  react: (k) => sfx(k === "success" ? "success" : "soft"),
  say: (text, lang = "uz") => speak(text, lang),
  lastAccept: demoLastAccept,
};

export const PlayContext = createContext<PlayCtx>(DEMO_PLAY);

/** Records an accepted press for the shared debounce window (kept outside components for the React compiler). */
export function markAccept(ctx: PlayCtx) {
  ctx.lastAccept.current = performance.now();
}
export const usePlay = () => useContext(PlayContext);
