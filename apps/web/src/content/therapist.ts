// The therapist form (spec §6): T1 is the therapist's own profile, T2–T11 are answers about one shared child.
// Same rules as the server (apps/api/app/modules/therapists/form.py). T9 (notes on clips) are the replies to the
// parent's movement clips (B25). Text: messages/pro.ts `tform.*`; the options reuse the parent questions' words.
// IQ6: "L" is section L of the CEO's questionnaire (its L2 is T2, its L9 is T6). A T6 answer ends the questionnaire's
// red-flag hold and replaces its restrictions (rule 4); the L scores are never shown to the parent (rule 1).

import type { GoalKey, Restriction, TherapistInput } from "@/lib/types";
import { STEPS } from "./intake";

export const PROFESSIONS = ["physio", "speech", "defectologist_ot", "neurologist"] as const;
export type Profession = (typeof PROFESSIONS)[number];

export interface TherapistProfile {
  userId: string;
  profession: Profession;
  workplace: string;
}

export type Level = 1 | 2 | 3 | 4 | 5;
export interface TherapistAnswers {
  T2?: Level; // gross motor (GMFCS)
  T3?: Level; // hand use (MACS)
  T4?: Level; // communication (CFCS)
  T5?: { type: string | null; parts: string | null };
  T6?: { items: string[]; text: string };
  T7?: { goals: string[]; own: string[] };
  T8?: { assign: string[]; exclude: string[] }; // exercise ids from the approved library
  T10?: "weekly" | "every_2_weeks" | "monthly";
  T11?: string;
  L?: Record<string, string | string[] | number>; // section L answers, by question id (content/questionnaire.json)
}
export type FormId = keyof TherapistAnswers;
export const FORM_IDS: FormId[] = ["T2", "T3", "T4", "T5", "T6", "T7", "T8", "T10", "T11", "L"];
/** A change to these rebuilds the plan at once (restrictions, movement level, goals, exercises). */
export const REBUILDS: FormId[] = ["T2", "T5", "T6", "T7", "T8"];
export const LEVELS: Level[] = [1, 2, 3, 4, 5];
export const UPDATES = ["weekly", "every_2_weeks", "monthly"] as const;
export const MAX_GOALS = 3;

/** T2, T6, T7 always; T3 for physio / LFK and OT; T4 for speech therapists (spec §6). */
export function requiredFor(p: Profession): FormId[] {
  const extra: Partial<Record<Profession, FormId[]>> = { physio: ["T3"], defectologist_ot: ["T3"], speech: ["T4"] };
  return FORM_IDS.filter((id) => ["T2", "T6", "T7", ...(extra[p] ?? [])].includes(id));
}

const options = (id: string) => STEPS.flatMap((s) => s.questions).find((q) => q.id === id)?.options ?? [];
/** The parent questions' options the form reuses. */
export const CP_TYPES = options("P10");
export const CP_PARTS = options("P11");
export const MUST_NOT = [...options("P14"), "high_intensity"]; // + L9's "maximum effort"
export const GOALS = options("P33");

/** Is this answer given (so a required one counts as done)? */
export function answered(a: TherapistAnswers, id: FormId): boolean {
  const v = a[id];
  if (v === undefined) return false;
  if (id === "T5") return !!(a.T5?.type || a.T5?.parts);
  if (id === "T6") return !!a.T6 && (a.T6.items.length > 0 || a.T6.text.trim() !== "");
  if (id === "T7") return !!a.T7 && a.T7.goals.length + a.T7.own.filter((g) => g.trim()).length > 0;
  if (id === "T8") return !!a.T8 && a.T8.assign.length + a.T8.exclude.length > 0;
  if (id === "T11") return !!a.T11?.trim();
  if (id === "L") return !!a.L && Object.keys(a.L).length > 0;
  return true;
}

export const missing = (a: TherapistAnswers, p: Profession) => requiredFor(p).filter((id) => !answered(a, id));

// ponytail: GMFCS level to the parent's P12 words, a first mapping; to be checked with the physiotherapist (C8).
export const GMFCS_TO_P12 = ["walks", "walks_help", "walker", "wheelchair", "needs_help_sit"] as const;
const HEALTH: FormId[] = ["T2", "T3", "T4", "T5", "T6", "L"];

/** The parent answers a therapist's answers replace (spec §6): T2 → P12, T5 → P10/P11, T6 → P14 (and the
 *  questionnaire's red flags `_hold`, `_restrictions`), T7 → P33. */
export function replaces(a: TherapistAnswers, healthConsent: boolean): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const allowed = (id: FormId) => healthConsent || !HEALTH.includes(id);
  if (a.T2 && allowed("T2")) out.P12 = GMFCS_TO_P12[a.T2 - 1];
  if (a.T5 && allowed("T5")) {
    if (a.T5.type) out.P10 = a.T5.type;
    if (a.T5.parts) out.P11 = a.T5.parts;
  }
  if (a.T6 && allowed("T6")) {
    out.P14 = [...a.T6.items, ...(a.T6.text.trim() && !a.T6.items.includes("other") ? ["other"] : [])];
    Object.assign(out, { _hold: [], _restrictions: [] });
  }
  if (a.T7?.goals.length) out.P33 = a.T7.goals;
  return out;
}

const T6_TAGS: Restriction[] = ["jumping", "prone", "neck_flexion", "single_leg_weight", "high_intensity"];

/** What the child's therapists set, for the plan engine (lib/roadmap.ts). The newest T2 and T7 are used; the
 * restrictions (T6) and the assigned and excluded exercises (T8) of every therapist count, and an exclusion beats an
 * assignment. `rows` oldest first. */
export function therapistInput(rows: TherapistAnswers[], healthConsent: boolean): TherapistInput | undefined {
  if (!rows.length) return undefined;
  const last = <K extends FormId>(k: K) => rows.map((r) => r[k]).filter((v) => v !== undefined).at(-1) as TherapistAnswers[K];
  const exclude = [...new Set(rows.flatMap((r) => r.T8?.exclude ?? []))];
  const t2 = healthConsent ? last("T2") : undefined;
  return {
    gmfcs: t2,
    restrictions: healthConsent ? [...new Set(rows.flatMap((r) => (r.T6?.items ?? []).filter((x): x is Restriction => T6_TAGS.includes(x as Restriction))))] : [],
    goals: (last("T7")?.goals ?? []) as GoalKey[],
    assign: [...new Set(rows.flatMap((r) => r.T8?.assign ?? []))].filter((e) => !exclude.includes(e)),
    exclude,
    legBalanceApproved: false,
  };
}
