import type { Lang } from "@/lib/translate";
import data from "./backend/questionnaire.json";

// The CEO's parent questionnaire of 16 Oct 2026 (IQ1): its questions and which ones a parent is shown.
// The same file and the same logic as the server (apps/api/app/modules/intake/questionnaire.py);
// questionnaire_cases.json proves the two agree. "Not sure" (null) or no answer never matches a rule.

export type QAnswer = string | string[] | number | null | undefined;
export type QAnswers = Record<string, QAnswer>;
type Fact = "age" | "gmfcs" | "macs" | "cfcs" | "pattern" | "cp_type";
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
  /** A step-by-step skill question: tick boxes on screen, still one answer (the hardest ticked) in the data (B68). */
  ladder?: boolean;
  /** The options under small headings (B74); a group with `text` null has no heading. */
  option_groups?: { text: Record<string, string> | null; options: string[] }[];
  /** One skill, two choices (B74): a "by themselves" option → its "only with help" option, shown as one row with the
   * text in `pair_text` (language → "by themselves" option → text). The saved value stays the array of option ids. */
  pair?: Record<string, string>;
  pair_text?: Record<string, Record<string, string>>;
  /** This question's own words for the automatic "Not sure" (B74). */
  not_sure_text?: Record<string, string>;
  /** Shown right under the question before it, indented, as part of it (B74). */
  follow_up?: boolean;
}

export const QUESTIONNAIRE = data as unknown as {
  version: string;
  steps: string[];
  step_text: Record<string, Record<string, string>>;
  /** One line under each section's title: what it asks about (B67). */
  step_intro: Record<string, Record<string, string>>;
  defs: Record<string, Cond>;
  questions: QQuestion[];
};
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

/** B69: the CP type the rules and P10 read, from the types ticked in CP1_types: one type → that type; "mixed", or
 * two or more types → "mixed"; "dont_know" → "dont_know". An old round's CP1 answer still counts. null: not
 * answered or "Not sure". Same as the server's cp_type. */
export function cpType(a: QAnswers): string | null {
  const ticked = a.CP1_types;
  if (!Array.isArray(ticked) || !ticked.length) return typeof a.CP1 === "string" ? a.CP1 : null;
  const types = ["spastic", "dyskinetic", "ataxic"].filter((t) => ticked.includes(t));
  if (ticked.includes("mixed") || types.length >= 2) return "mixed";
  if (types.length) return types[0];
  return ticked.includes("dont_know") ? "dont_know" : null;
}

const HOME_CODE: Record<string, string> = { uzbek: "uz", russian: "ru", en: "en", other: "other" };

/** B72: the language spoken with the child at home, from the ones ticked in A7_langs: one language → that one; several
 * → the app's language if it is ticked, otherwise the first of uz, ru, en; only "other" → "other". An old round's A7
 * answer still counts. null: not answered. Same as the server's home_language. */
export function homeLanguage(a: QAnswers, ui: string): string | null {
  const ticked = a.A7_langs;
  if (!Array.isArray(ticked) || !ticked.length) return typeof a.A7 === "string" ? (HOME_CODE[a.A7] ?? null) : null;
  const codes = ticked.map((o) => HOME_CODE[o]);
  const langs = ["uz", "ru", "en"].filter((l) => codes.includes(l));
  if (!langs.length) return codes.includes("other") ? "other" : null;
  return langs.includes(ui) ? ui : langs[0];
}

const INCH_CM = 2.54;
const LB_KG = 0.45359237;
/** B72: height and weight in US units, converted here only; the server always gets cm and kg. kg keeps one decimal, so
 * 11 lb is 5.0 kg and the range's own ends (1 ft 0 in – 8 ft 2 in, 11 – 440 lb) pass the cm and kg check. */
export const cmFromFtIn = (ft: number, inches: number) => Math.round((ft * 12 + inches) * INCH_CM);
export const kgFromLb = (lb: number) => Math.round(lb * LB_KG * 10) / 10;
export const lbFromKg = (kg: number) => Math.round(kg / LB_KG);
export function ftInFromCm(cm: number): { ft: number; inches: number } {
  const all = Math.round(cm / INCH_CM);
  return { ft: Math.floor(all / 12), inches: all % 12 };
}

/** Age in years, the GMFCS, MACS and CFCS levels (1-5; a therapist's L2 wins over the parent's C10), the body
 * pattern (bodyPattern) and the CP type (cpType). */
export const facts = (a: QAnswers, today: string): Record<Fact, number | string | null> => ({
  pattern: bodyPattern(a),
  cp_type: cpType(a),
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

/** Questions with their own "Don't know" answer: no automatic "Not sure" next to it (B66; in Uzbek both read
 * "Bilmayman"). Same list as the server's OWN_DONT_KNOW. */
export const OWN_DONT_KNOW = new Set(["CP1", "CP1_types", "DS1", "E1"]);
/** Questions without the automatic "Not sure": name, birthday and the family facts (B60, TASKS.md section 3
 * replaces spec §5 for these), and OWN_DONT_KNOW. Same list as the server's. */
export const NO_NOT_SURE = new Set(["A1", "A2", "A3", "A4", "A4_kg", "A5", "A7_langs", "A9", "B1", "B3_parts", ...OWN_DONT_KNOW]);

/** Does this question get the automatic "Not sure" (stored as null)? Required ones do, optional ones only with
 * `not_sure` (B63), and never one that has a "not_sure" option of its own. */
export const offersNotSure = (q: QQuestion) => (q.required || !!q.not_sure) && !NO_NOT_SURE.has(q.id) && !q.options?.includes("not_sure");

// Step-by-step skill questions (`ladder`, B68): the parent ticks everything the child can do, the answer stays one
// option, the hardest one ticked. `options` is the list shown (in order, easiest first); its first option ("can't")
// stands alone, like "Not sure" (null), which is not a tick box here.

/** The boxes to tick for a saved answer: the saved option and every one before it, except the first ("can't"). */
export function ladderTicks(options: string[], v: QAnswer): string[] {
  if (typeof v !== "string") return [];
  const at = options.indexOf(v);
  if (at < 0) return [];
  return at === 0 ? [v] : options.slice(1, at + 1);
}

/** The boxes after tapping `o`: the first option clears the rest, any other clears the first; a ticked box unticks. */
export function ladderToggle(options: string[], ticked: string[], o: string): string[] {
  const on = new Set(ticked.includes(o) ? ticked.filter((x) => x !== o) : o === options[0] ? [o] : [...ticked.filter((x) => x !== options[0]), o]);
  return options.filter((x) => on.has(x));
}

/** The answer saved for the ticked boxes: the hardest one (last in `options` order); nothing ticked = no answer. */
export function ladderValue(options: string[], ticked: string[]): string | undefined {
  return options.filter((x) => ticked.includes(x)).at(-1);
}

/** A tick-all question's boxes after tapping `o`: the exclusive option stands alone, the two choices of a pair untick
 * each other (B74), and past `max` nothing changes. */
export function toggleOption(q: QQuestion, picked: string[], o: string): string[] {
  if (o === q.exclusive) return picked.includes(o) ? [] : [o];
  if (picked.includes(o)) return picked.filter((x) => x !== o);
  const pairs = Object.entries(q.pair ?? {});
  const other = pairs.find(([alone]) => alone === o)?.[1] ?? pairs.find(([, help]) => help === o)?.[0];
  const next = [...picked.filter((x) => x !== q.exclusive && x !== other), o];
  return q.max && next.length > q.max ? picked : next;
}

const I8_MOVES: Record<string, Record<string, string>> = {
  I8_place: { state: "state", private: "private" },
  I8_lang: { uzbek_doctor: "uz", russian_doctor: "ru" },
};

/** Saved answers in today's options: a retired option shows as the option that replaced it (B61, B62); an older
 * round's "Not sure" (null) on a question with its own "Don't know" shows as that answer (B66); an old answer with
 * both choices of a pair ticked counts as "by themselves" (B74). */
export function upgrade(a: QAnswers): QAnswers {
  const to = (id: string, v: string) => Q_BY_ID[id]?.retired_options?.[v] ?? v;
  const dontKnow = (id: string) => (Q_BY_ID[id]?.kind === "multi" ? ["dont_know"] : "dont_know");
  const out: QAnswers = Object.fromEntries(
    Object.entries(a).map(([id, v]) => [
      id,
      v === null && OWN_DONT_KNOW.has(id) ? dontKnow(id) : typeof v === "string" ? to(id, v) : Array.isArray(v) ? [...new Set(v.map((x) => to(id, x)))] : v,
    ]),
  );
  // B69: an open round answered with the retired CP1 shows that type ticked in CP1_types.
  const cp1 = out.CP1;
  if (out.CP1_types === undefined && typeof cp1 === "string" && Q_BY_ID.CP1_types?.options?.includes(cp1)) out.CP1_types = [cp1];
  // B72: an old round's A7 shows that language ticked in A7_langs (the same option ids).
  if (out.A7_langs === undefined && typeof out.A7 === "string") out.A7_langs = [out.A7];
  // B75: an old round's I8 shows as its two replacements.
  if (Array.isArray(out.I8) && out.I8_place === undefined && out.I8_lang === undefined) {
    for (const [id, map] of Object.entries(I8_MOVES)) {
      const moved = out.I8.flatMap((o) => map[o] ?? []);
      if (moved.length) out[id] = moved;
    }
  }
  for (const [id, v] of Object.entries(out)) {
    const pairs = Object.entries(Q_BY_ID[id]?.pair ?? {});
    if (pairs.length && Array.isArray(v)) out[id] = v.filter((x) => !pairs.some(([alone, help]) => x === help && v.includes(alone)));
  }
  return out;
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
