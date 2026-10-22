import type { Lang } from "@/lib/translate";
import data from "./backend/questionnaire.json";

// The CEO's parent questionnaire of 16 Oct 2026 (IQ1): its questions and which ones a parent is shown.
// The same file and the same logic as the server (apps/api/app/modules/intake/questionnaire.py);
// questionnaire_cases.json proves the two agree. "Not sure" (null) or no answer never matches a rule.

export type QAnswer = string | string[] | number | null | undefined;
export type QAnswers = Record<string, QAnswer>;
type Fact = "age" | "gmfcs" | "macs" | "cfcs";
export type Cond =
  | { ref: string }
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { fact: Fact; in?: number[]; min?: number; max?: number }
  | { q: string; in?: string[]; answered?: boolean; min?: number; max?: number };

export interface QQuestion {
  id: string;
  step: string;
  kind: string;
  required: boolean;
  health: boolean;
  audience: "parent" | "therapist";
  options: string[] | null;
  max: number | null;
  exclusive: string | null;
  show: Cond | null;
  option_show: Record<string, Cond> | null;
  unit: string | null;
  range: number[] | null;
  picture: string | null;
  signup: boolean;
  feeds: string[];
  text: Record<string, string>;
  option_text: Record<string, Record<string, string>> | null;
  note?: string;
}

export const QUESTIONNAIRE = data as unknown as { version: string; steps: string[]; step_text: Record<string, Record<string, string>>; defs: Record<string, Cond>; questions: QQuestion[] };
export const Q_BY_ID: Record<string, QQuestion> = Object.fromEntries(QUESTIONNAIRE.questions.map((q) => [q.id, q]));
/** A question's, option's or section's text in the parent's language (IQ5). */
export function inLang(texts: Record<string, Record<string, string>> | Record<string, string>, ui: Lang, key?: string): string {
  const pick = (l: string) => {
    const t = (texts as Record<string, Record<string, string> | string>)[l];
    return typeof t === "string" ? t : key !== undefined ? t?.[key] : undefined;
  };
  return pick(ui) ?? pick("en") ?? key ?? "";
}

const LEVEL: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };

function years(born: QAnswer, today: string): number | null {
  if (typeof born !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(born)) return null;
  const [by, bm, bd] = born.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

const level = (v: QAnswer) => (typeof v === "string" && v in LEVEL ? LEVEL[v] : null);

/** Age in years and the GMFCS, MACS and CFCS levels (1-5). A therapist's L2 wins over the parent's C10. */
export const facts = (a: QAnswers, today: string): Record<Fact, number | null> => ({
  age: years(a.A2, today),
  gmfcs: level(a.L2 || a.C10),
  macs: level(a.D1),
  cfcs: level(a.G2),
});

const given = (v: QAnswer) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
const inRange = (v: unknown, c: { min?: number; max?: number }) =>
  typeof v === "number" && (c.min === undefined || v >= c.min) && (c.max === undefined || v <= c.max);

export function holds(cond: Cond | null | undefined, a: QAnswers, f: Record<Fact, number | null>): boolean {
  if (!cond) return true;
  if ("ref" in cond) return holds(QUESTIONNAIRE.defs[cond.ref], a, f);
  if ("all" in cond) return cond.all.every((c) => holds(c, a, f));
  if ("any" in cond) return cond.any.some((c) => holds(c, a, f));
  if ("not" in cond) return !holds(cond.not, a, f);
  if ("fact" in cond) {
    const v = f[cond.fact];
    return cond.in ? v !== null && cond.in.includes(v) : inRange(v, cond);
  }
  const v = a[cond.q];
  if (cond.answered !== undefined) return given(v) === cond.answered;
  if (cond.in) return Array.isArray(v) ? v.some((x) => cond.in!.includes(x)) : typeof v === "string" && cond.in.includes(v);
  return inRange(v, cond);
}

export const shown = (id: string, a: QAnswers, today: string) => holds(Q_BY_ID[id].show, a, facts(a, today));

/** The options this parent sees (R8, R11, R15 hide some); null for a question without options. */
export function shownOptions(id: string, a: QAnswers, today: string): string[] | null {
  const q = Q_BY_ID[id];
  if (!q.options) return null;
  const f = facts(a, today);
  return q.options.filter((o) => holds(q.option_show?.[o], a, f));
}

/** Every question this child's parent is asked now, in questionnaire order (sign-up questions left out). */
export function visible(a: QAnswers, today: string, audience: "parent" | "therapist" = "parent"): string[] {
  const f = facts(a, today);
  return QUESTIONNAIRE.questions.filter((q) => q.audience === audience && !q.signup && holds(q.show, a, f)).map((q) => q.id);
}
