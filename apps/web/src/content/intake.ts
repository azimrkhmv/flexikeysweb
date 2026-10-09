// Parent intake P1–P41 (spec §5) as data. One generic wizard (features/intake) renders it.
// Text: messages/intake.ts — `intake.<id>` for the question, `intake.<id>.<option>` for each option.
// P6 (language) and P7 (district) are answered at sign-up; P17a (material allergies) when ordering a Home Kit.

import type { IntakeValue } from "@/lib/types";

export type Answers = Record<string, IntakeValue | undefined>;
export type QKind = "text" | "longtext" | "date" | "single" | "multi" | "ability" | "media" | "phone";

export interface Question {
  id: string;
  kind: QKind;
  options?: string[];
  required: boolean;
  /** Max picks for multi (P33: 1–3). */
  max?: number;
  /** An option that clears the others (P14 "Nothing", P16 "None"). */
  exclusive?: string;
  showIf?: (a: Answers) => boolean;
}

export type StepId = "child" | "health_consent" | "diagnosis" | "safety" | "talk" | "hands" | "everyday" | "goals" | "routine" | "words" | "videos" | "invite";

export interface Step {
  id: StepId;
  /** Section B needs the health consent (spec §4). */
  health?: boolean;
  optional?: boolean;
  questions: Question[];
}

const has = (id: string, v: string) => (a: Answers) => {
  const x = a[id];
  return Array.isArray(x) ? x.includes(v) : x === v;
};

/** Spec §5: every required question except name, birthday, district and language has a "Not sure" answer. */
export const NO_NOT_SURE = new Set(["P1", "P2"]);
export const allowsNotSure = (q: Question) => q.required && !NO_NOT_SURE.has(q.id) && q.kind !== "ability";

export const STEPS: Step[] = [
  {
    id: "child",
    questions: [
      { id: "P1", kind: "text", required: true },
      { id: "P2", kind: "date", required: true },
      { id: "P3", kind: "single", options: ["boy", "girl"], required: true },
      { id: "P4", kind: "single", options: ["mother", "father", "grandparent", "carer"], required: true },
      { id: "P5", kind: "single", options: ["parent", "therapist", "together"], required: true },
      { id: "P8", kind: "single", options: ["sky", "leaf", "sun", "lavender", "peach"], required: false },
    ],
  },
  { id: "health_consent", questions: [] },
  {
    id: "diagnosis",
    health: true,
    questions: [
      { id: "P9", kind: "multi", options: ["cp", "autism", "down", "speech_delay", "adhd", "other", "not_diagnosed"], required: true },
      { id: "P9_other", kind: "text", required: false, showIf: has("P9", "other") },
      { id: "P10", kind: "single", options: ["spastic", "dyskinetic", "ataxic", "mixed", "dont_know"], required: false, showIf: has("P9", "cp") },
      { id: "P11", kind: "single", options: ["one_side", "legs", "whole_body", "dont_know"], required: false, showIf: has("P9", "cp") },
      { id: "P12", kind: "single", options: ["walks", "walks_help", "walker", "wheelchair", "needs_help_sit"], required: true },
    ],
  },
  {
    id: "safety",
    health: true,
    questions: [
      { id: "P13", kind: "single", options: ["last_year", "earlier", "never"], required: true },
      { id: "P14", kind: "multi", options: ["jumping", "prone", "neck_flexion", "single_leg_weight", "other", "nothing"], exclusive: "nothing", required: true },
      { id: "P14_other", kind: "text", required: false, showIf: has("P14", "other") },
      { id: "P15", kind: "single", options: ["yes", "no"], required: true },
      { id: "P15_part", kind: "multi", options: ["legs", "arms", "hands", "trunk", "head_neck", "mouth_face"], required: true, showIf: has("P15", "yes") },
      { id: "P15_date", kind: "date", required: false, showIf: has("P15", "yes") },
      { id: "P16", kind: "multi", options: ["walker", "wheelchair", "braces", "glasses", "hearing_aid", "comm_board", "none"], exclusive: "none", required: false },
      { id: "P17", kind: "single", options: ["yes", "sometimes", "no"], required: false },
    ],
  },
  {
    id: "talk",
    questions: [
      { id: "P18", kind: "ability", required: true },
      { id: "P19", kind: "ability", required: true },
      { id: "P20", kind: "ability", required: true },
      { id: "P21", kind: "ability", required: true },
      { id: "P22", kind: "single", options: ["words", "pointing", "sounds", "pictures"], required: true },
    ],
  },
  {
    id: "hands",
    questions: [
      { id: "P23", kind: "ability", required: true },
      { id: "P24", kind: "ability", required: true },
      { id: "P25", kind: "single", options: ["letters", "lines", "not_yet"], required: true },
      { id: "P26", kind: "ability", required: true },
      { id: "P27", kind: "ability", required: true },
    ],
  },
  {
    id: "everyday",
    questions: [
      { id: "P28", kind: "single", options: ["yes", "glasses"], required: true },
      { id: "P29", kind: "ability", required: true },
      { id: "P30", kind: "ability", required: true },
      { id: "P31", kind: "ability", required: true },
      { id: "P32", kind: "ability", required: true },
    ],
  },
  {
    id: "goals",
    questions: [
      { id: "P33", kind: "multi", options: ["walk", "hands", "sit", "communicate", "understand", "eat", "play_others", "school"], max: 3, required: true },
      { id: "P34", kind: "single", options: ["10", "20", "30"], required: true },
    ],
  },
  {
    id: "routine",
    optional: true,
    questions: [
      { id: "P35", kind: "single", options: ["morning", "afternoon", "evening"], required: false },
      { id: "P36", kind: "single", options: ["home", "kindergarten", "rehab", "school"], required: false },
      { id: "P37", kind: "multi", options: ["music", "cars", "animals", "cartoons", "water", "balls", "other"], required: false },
      { id: "P38", kind: "longtext", required: false },
    ],
  },
  { id: "words", optional: true, questions: [{ id: "P39", kind: "longtext", required: false }] },
  { id: "videos", optional: true, health: true, questions: [{ id: "P40", kind: "media", required: false }] },
  { id: "invite", optional: true, questions: [{ id: "P41", kind: "phone", required: false }] },
];

/** Questions that apply to these answers (hidden follow-ups and, without health consent, section B are left out). */
export function visibleQuestions(step: Step, a: Answers): Question[] {
  return step.questions.filter((q) => !q.showIf || q.showIf(a));
}

/** A required question is done when it has any answer, "Not sure" (null) included. */
export function stepComplete(step: Step, a: Answers): boolean {
  return visibleQuestions(step, a).every((q) => {
    if (!q.required) return true;
    const v = a[q.id];
    if (v === undefined || v === "") return false;
    return !Array.isArray(v) || v.length > 0;
  });
}

export const P39_MAX = 1000;
export const P40_MAX_CLIPS = 3;
