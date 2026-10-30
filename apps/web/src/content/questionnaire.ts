import type { Lang } from "@/lib/translate";
import data from "./backend/questionnaire.json";

// The CEO's parent questionnaire of 16 Oct 2026 (IQ1): its questions and which ones a parent is shown.
// The same file and the same logic as the server (apps/api/app/modules/intake/questionnaire.py);
// questionnaire_cases.json proves the two agree. "Not sure" (null) or no answer never matches a rule.

export type QAnswer = string | string[] | number | null | undefined;
export type QAnswers = Record<string, QAnswer>;
type Fact = "age" | "gmfcs" | "macs" | "cfcs" | "pattern";
export type Cond =
  | { ref: string }
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { fact: Fact; in?: (number | string)[]; min?: number; max?: number }
  | { q: string; in?: string[]; answered?: boolean; min?: number; max?: number };

export interface QQuestion {
  id: string;
  step: string;
  kind: string;
  required: boolean;
  health: boolean;
  audience: "parent" | "therapist";
  options: string[] | null;
  /** Options no longer shown; old answers with them stay valid, and map to the new option when one is named (B61). */
  retired_options?: Record<string, string | null>;
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
  /** An optional question that still offers "Not sure", stored as null like a required one's (B63). */
  not_sure?: boolean;
  /** A short help line under the question, in smaller grey text (B60, B62). */
  hint?: Record<string, string>;
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

/** The child's age in whole months on `today`, or null without a date of birth. */
export function ageInMonths(born: QAnswer, today: string): number | null {
  if (typeof born !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(born)) return null;
  const [by, bm, bd] = born.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return (ty - by) * 12 + tm - bm - (td < bd ? 1 : 0);
}

/** B61: the pattern the rules read (as the retired B3 asked it), worked out from the body parts ticked in B3_parts.
 * An old round's B3 answer still counts. null: nothing ticked, "None", or not answered. */
export function bodyPattern(a: QAnswers): string | null {
  if (!Array.isArray(a.B3_parts)) {
    const old = a.B3;
    return typeof old === "string" && ["right_side", "left_side", "mostly_legs", "whole_body"].includes(old) ? old : null;
  }
  const p = new Set(a.B3_parts.filter((x) => x !== "none"));
  const has = (...xs: string[]) => xs.filter((x) => p.has(x)).length;
  const right = has("right_arm", "right_leg");
  const left = has("left_arm", "left_leg");
  const arms = has("left_arm", "right_arm");
  const legs = has("left_leg", "right_leg");
  if (!p.size) return null;
  if (!right && !left) return "whole_body"; // trunk, head and neck, or face and mouth only
  if (!left) return "right_side";
  if (!right) return "left_side";
  if ((arms === 2 && legs === 2) || has("trunk", "head_neck")) return "whole_body"; // all four limbs, or both sides with the trunk or head and neck
  if (legs === 2) return arms ? "three_limbs" : "mostly_legs";
  return "whole_body"; // limbs on both sides in another mix: the cautious reading
}

/** Age in years, the GMFCS, MACS and CFCS levels (1-5; a therapist's L2 wins over the parent's C10) and the body
 * pattern (bodyPattern). */
export const facts = (a: QAnswers, today: string): Record<Fact, number | string | null> => ({
  pattern: bodyPattern(a),
  age: years(a.A2, today),
  gmfcs: level(a.L2 || a.C10),
  macs: level(a.D1),
  cfcs: level(a.G2),
});

const given = (v: QAnswer) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
const inRange = (v: unknown, c: { min?: number; max?: number }) =>
  typeof v === "number" && (c.min === undefined || v >= c.min) && (c.max === undefined || v <= c.max);

export function holds(cond: Cond | null | undefined, a: QAnswers, f: Record<Fact, number | string | null>): boolean {
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

/** Saved answers in today's options: a retired option shows as the option that replaced it (B61, B62). */
export function upgrade(a: QAnswers): QAnswers {
  const to = (id: string, v: string) => Q_BY_ID[id]?.retired_options?.[v] ?? v;
  return Object.fromEntries(
    Object.entries(a).map(([id, v]) => [id, typeof v === "string" ? to(id, v) : Array.isArray(v) ? [...new Set(v.map((x) => to(id, x)))] : v]),
  );
}

/** FlexiKeys is for children aged 2 to 18 (founders, 30 Oct 2026). */
export const AGE_MIN = 2;
export const AGE_MAX = 18;

function realDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d); // not Date.UTC: it reads years 0-99 as 1900-1999
  return y >= 1 && t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Why the server (questionnaire.py problem_with, older_than_child) would refuse this typed answer, for a calm
 * message under the field; null when it is fine. Choices are never wrong, so only dates and numbers are checked. */
export function typedProblem(q: QQuestion, v: QAnswer, a: QAnswers, today: string): string | null {
  if (q.kind === "months" && typeof v === "number") {
    const months = ageInMonths(a.A2, today);
    return months !== null && v > months ? "older_than_child" : null;
  }
  if (q.kind === "date" && typeof v === "string") {
    if (!realDate(v)) return "not_a_date";
    if (v > today) return "date_in_future";
    if (q.id !== "A2") return v < "1990-01-01" ? "not_a_date" : null;
    const age = years(v, today)!;
    return age < AGE_MIN || age > AGE_MAX ? "age_out_of_range" : null;
  }
  if (q.kind === "number" && typeof v === "number" && q.range && (v < q.range[0] || v > q.range[1])) return "out_of_range";
  return null;
}

/** Every question this child's parent is asked now, in questionnaire order (sign-up questions left out). */
export function visible(a: QAnswers, today: string, audience: "parent" | "therapist" = "parent"): string[] {
  const f = facts(a, today);
  return QUESTIONNAIRE.questions.filter((q) => q.audience === audience && !q.signup && holds(q.show, a, f)).map((q) => q.id);
}
