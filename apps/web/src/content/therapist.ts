// The therapist form (spec §6): T1 is the therapist's own profile, T2–T11 are answers about one shared child.
// Same rules as the server (apps/api/app/modules/therapists/form.py). T8 (exercises) and T9 (notes on clips) come
// with B25. Text: messages/pro.ts `tform.*`; the options reuse the parent questions' words (`intake.P10.*` …).

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
  T10?: "weekly" | "every_2_weeks" | "monthly";
  T11?: string;
}
export type FormId = keyof TherapistAnswers;
export const FORM_IDS: FormId[] = ["T2", "T3", "T4", "T5", "T6", "T7", "T10", "T11"];
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
export const MUST_NOT = options("P14");
export const GOALS = options("P33");

/** Is this answer given (so a required one counts as done)? */
export function answered(a: TherapistAnswers, id: FormId): boolean {
  const v = a[id];
  if (v === undefined) return false;
  if (id === "T5") return !!(a.T5?.type || a.T5?.parts);
  if (id === "T6") return !!a.T6 && (a.T6.items.length > 0 || a.T6.text.trim() !== "");
  if (id === "T7") return !!a.T7 && a.T7.goals.length + a.T7.own.filter((g) => g.trim()).length > 0;
  if (id === "T11") return !!a.T11?.trim();
  return true;
}

export const missing = (a: TherapistAnswers, p: Profession) => requiredFor(p).filter((id) => !answered(a, id));
