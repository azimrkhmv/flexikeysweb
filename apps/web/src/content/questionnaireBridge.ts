import type { QAnswer, QAnswers } from "./questionnaire";

// IQ3/IQ4: answers to the CEO's questionnaire read as the P1–P41 answers the plan engine uses, with the red flags
// (`_hold`, `_restrictions`). The same rules as the server (apps/api/app/modules/intake/bridge.py);
// bridge_cases.json proves the two agree. Not answered stays the cautious choice (product rule 2).

const RECENT_DAYS = 183;
const GMFCS_P12: Record<string, string> = { i: "walks", ii: "walks_help", iii: "walker", iv: "wheelchair", v: "needs_help_sit" };
const GOALS: Record<string, string[]> = { sit: ["sit"], stand: ["walk"], walk: ["walk"], hands_eat: ["eat", "hands"], hold: ["hands"], communicate: ["communicate"], tablet: ["understand"], school: ["school"] };
const SURGERY_PART: Record<string, string[]> = { hip: ["legs"], tendon: ["legs"], spine: ["trunk"], shunt: ["head_neck"], other: ["legs", "arms", "hands", "trunk", "head_neck"] };
const BODY_PART: Record<string, string> = {
  head_neck: "head_neck", shoulders: "arms", back: "trunk", hips: "legs", left_arm: "arms", right_arm: "arms", left_hand: "hands",
  right_hand: "hands", left_leg: "legs", right_leg: "legs", left_foot: "legs", right_foot: "legs",
};
const DX: Record<string, string> = { cp: "cp", autism: "autism", down_syndrome: "down", dcd: "other", developmental_delay: "other", other: "other", no_diagnosis: "not_diagnosed", not_sure: "not_diagnosed" };

const list = (v: QAnswer): string[] => (Array.isArray(v) ? v : []);
const pick = (v: QAnswer, map: Record<string, string>): string | undefined => (typeof v === "string" ? map[v] : undefined);
const ability = (v: QAnswer, scale: Record<string, number>): number | undefined => (typeof v === "string" ? scale[v] : undefined);
const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();

/** A date in the last 6 months; "Not sure" (no date) counts as recent. */
function recent(when: QAnswer, today: string): boolean {
  if (typeof when !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(when)) return true;
  return (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${when}T00:00:00Z`)) / 86_400_000 <= RECENT_DAYS;
}

/** P12 from the GMFCS picture, or for children without it (DCD, delay...) from the walking and sitting steps. */
function movement(a: QAnswers): string | undefined {
  if (typeof a.C10 === "string") return GMFCS_P12[a.C10];
  const walk = a.C6;
  if (walk === "alone_7m") return "walks";
  if (walk === "alone_few_m" || walk === "one_hand") return "walks_help";
  if (walk === "walker_two_hands" || walk === "adult_trunk") return "walker";
  if (walk === "doesnt_step" || walk === "gait_trainer") return a.C3 === "cant_sit" ? "needs_help_sit" : "wheelchair";
  return undefined;
}

export type PAnswers = Record<string, string | string[] | number | null>;

export function pView(a: QAnswers, today: string): PAnswers {
  const dx = new Set(list(a.B1));
  const p: Record<string, string | string[] | number | null | undefined> = { P1: a.A1 as string, P2: a.A2 as string, P3: a.A3 as string };
  const p9 = sorted([...dx].map((d) => DX[d]));
  p.P9 = p9.length ? p9 : undefined;
  p.P10 = typeof a.CP1 === "string" ? a.CP1 : undefined;
  p.P11 = pick(a.CP2, { one_side: "one_side", legs: "legs", three_limbs: "whole_body", whole_body: "whole_body" });
  p.P12 = movement(a);
  p.P13 = pick(a.B6, { no: "never", controlled: "last_year", still: "last_year" });
  p.P14 = null; // not asked: every listed restriction until a therapist sets them (IQ6)
  const surgery = a.B8 === "yes" && recent(a.B8_date, today);
  const botox = a.CP3 === "yes" && recent(a.CP3_date, today);
  const parts = new Set<string>(surgery ? list(a.B8_type).flatMap((t) => SURGERY_PART[t] ?? []) : []);
  if (botox) {
    const muscles = list(a.CP3_muscles).filter((m) => m in BODY_PART).map((m) => BODY_PART[m]);
    (muscles.length ? muscles : ["legs"]).forEach((x) => parts.add(x));
  }
  const known = (a.B8 === "yes" || a.B8 === "no") && (a.CP3 === "yes" || a.CP3 === "no" || !dx.has("cp")); // Botox: CP only
  p.P15 = surgery || botox ? "yes" : known ? "no" : undefined;
  p.P15_part = parts.size ? sorted(parts) : undefined;
  p.P17 = pick(a.E10, { never: "no", sometimes: "yes", often: "yes", tube_fed: "yes" });
  p.P18 = ability(a.F1, { yes: 2, gesture: 1, no: 0 });
  p.P19 = ability(a.F2, { yes: 2, sometimes: 1, no: 0 });
  const talk = new Set(list(a.G1));
  p.P20 = talk.has("sentences") || talk.has("single_words") ? 2 : talk.has("sounds_gestures") ? 1 : talk.size ? 0 : undefined;
  p.P21 = talk.has("sentences") ? 2 : talk.has("single_words") ? 1 : talk.size ? 0 : undefined;
  p.P23 = ability(a.D4, { thumb_finger: 2, whole_hand: 1, cannot: 0 });
  p.P24 = ability(a.D12, { yes: 2, with_help: 1, no: 0 }) ?? ability(a.D11, { fingers: 2, fist: 1, cant: 0 });
  p.P26 = ability(a.D7, { accurately: 2, big_only: 1, with_help: 1, not_yet: 0 });
  p.P27 = ability(a.C3, { free_30min: 2, free_few_min: 2, hands_5min: 1, hands_under_10s: 1, cant_sit: 0 });
  p.P29 = ability(a.F6, { normal: 2, hearing_aid: 1, hard: 1, deaf: 0 });
  p.P30 = ability(a.F4, { over_15: 2, "5_15": 2, "1_5": 1, under_1: 0 });
  p.P31 = ability(a.H1, { self: 2, some_help: 1, i_feed: 0, tube: 0 });
  p.P32 = ability(a.H2, { alone: 2, helps: 1, no: 0 });
  const goals = [...new Set(list(a.J9).flatMap((g) => GOALS[g] ?? []))].slice(0, 3);
  p.P33 = goals.length ? goals : undefined;
  p.P34 = pick(a.J1, { "10": "10", "20": "20", "30": "30", "45": "30" });
  p.P35 = pick(a.H5, { morning: "morning", midday: "afternoon", afternoon: "afternoon", evening: "evening" });
  const likes = list(a.F9).filter((i) => ["music", "cars", "animals", "cartoons", "water", "balls"].includes(i));
  p.P37 = likes.length ? likes : undefined;

  const hold: string[] = [];
  const restrictions = new Set<string>();
  const b7 = list(a.B7);
  if (a.C12 === "yes") hold.push("lost_skill");
  if (surgery || botox) hold.push("recent_surgery_or_botox");
  if (a.B6 === "still") hold.push("seizures");
  if (a.DS2 === "yes" || b7.includes("heart")) hold.push("heart");
  if (dx.size === 1 && dx.has("autism")) hold.push("autism_only");
  if (a.DS1 !== "normal" && dx.has("down_syndrome")) ["neck_flexion", "prone"].forEach((r) => restrictions.add(r));
  if (a.E7 !== "no" || b7.includes("shunt") || a.E13 !== "no") restrictions.add("high_intensity");
  if (b7.includes("shunt") || a.E13 === "yes") ["prone", "neck_flexion"].forEach((r) => restrictions.add(r));
  const delay = ["developmental_delay", "no_diagnosis", "not_sure", "other"].some((d) => dx.has(d));
  if (a.DD4 !== "no" && !dx.has("cp") && delay) ["leg_balance", "high_intensity"].forEach((r) => restrictions.add(r));
  const pain = a.E3 === "sometimes" || a.E3 === "often" ? list(a.E4) : [];
  const bones = a.E7 === "yes" ? list(a.E7_where) : [];
  const painful = [...pain, ...bones].filter((x) => x in BODY_PART).map((x) => BODY_PART[x]);
  if (a.E3 === "often" && !pain.length) restrictions.add("high_intensity"); // no hard exercise (A4.8)
  if (painful.length) {
    p.P15_part = sorted([...((p.P15_part as string[] | undefined) ?? []), ...painful]);
    p.P15 = "yes";
  }
  p._hold = hold;
  p._restrictions = sorted(restrictions);
  return Object.fromEntries(Object.entries(p).filter(([k, v]) => v !== undefined || k === "P14")) as PAnswers;
}

/** A round's answers as the plan reads them: P1–P41 rounds as they are, the CEO's questionnaire through pView. */
export const rulesView = (questionnaire: string | undefined, a: QAnswers, today: string) =>
  !questionnaire || questionnaire === "p41" ? a : pView(a, today);
