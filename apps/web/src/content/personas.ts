import { quickVisible, type QAnswers } from "./questionnaire";

// Sample children for the questionnaire and plan tests. M, W and S are the personas of the 5 Nov review: only what
// is needed to place each child; the rest of the answers do not change what shows.
export const QC_IDS = ["QC_move", "QC_hands", "QC_body", "QC_senses", "QC_talk", "QC_daily"];
export const QC_ALL = (v: string): QAnswers => Object.fromEntries(QC_IDS.map((id) => [id, v]));
export const M: QAnswers = { ...QC_ALL("none"), QC_body: "some", QC_talk: "some", A2: "2016-05-01", A3: "girl", B1: ["developmental_delay"], B3_parts: ["face_mouth"], B7: ["intellectual"], B6: "no", B8: "no", DD3: "no", E1: "normal", E3: "never", E6_now: "no", E7: "no", E13: "no", I1: ["none"], J9: ["memory", "speech"], G1: ["single_words"] };
export const W: QAnswers = { ...QC_ALL("none"), QC_talk: "a_lot", A2: "2011-05-01", A3: "boy", B1: ["developmental_delay"], B3_parts: ["none"], B6: "no", B8: "no", DD3: "no", E7: "no", E13: "no", I1: ["none"], G1: ["sentences"] };
export const S: QAnswers = { ...QC_ALL("a_lot"), A2: "2023-05-01", B1: ["cp"], B3_parts: ["left_arm", "right_arm", "left_leg", "right_leg", "trunk"], CP1_types: ["spastic", "dyskinetic"], C10: "v", C3: "cant_sit", C5: "cant", C6: "doesnt_step", G1: ["face_crying"], B6: "no", B8: "no", CP3: "no", E1: "stiff", E3: "sometimes", E7: "no", E13: "no", I1: ["physio"] };

// B103: sample children for the quick start's plan, with the answers the quick start asks of each.
export const QUICK_CHILDREN: [string, QAnswers][] = [
  ["M", { ...M, A1: "Mira", A7_langs: ["uzbek"], C12: "no" }],
  ["W", { ...W, A1: "Wali", A7_langs: ["russian"], B7: ["none"], C12: "no", J9: ["communicate"] }],
  ["S", { ...S, A1: "Sardor", A3: "boy", A7_langs: ["uzbek"], B7: ["none"], C12: "no", E4: ["left_leg"], J9: ["sit", "hold"] }],
  ["Down syndrome, age 3", { ...QC_ALL("some"), A1: "Dilnoza", A2: "2023-03-15", A3: "girl", A7_langs: ["uzbek"], B1: ["down_syndrome"], B3_parts: ["trunk"], B6: "no", B7: ["none"], B8: "no", C12: "no", DS2: "no", E3: "never", E7: "no", E13: "no", J9: ["sit"] }],
  ["CP, walks, every area a little", { ...QC_ALL("some"), A1: "Ali", A2: "2019-05-01", A3: "boy", A7_langs: ["uzbek"], B1: ["cp"], B3_parts: ["left_arm", "left_leg"], B6: "no", B7: ["none"], B8: "no", CP3: "no", C10: "i", C12: "no", C6: "alone_7m", D7: "accurately", E3: "never", E7: "no", E13: "no", J9: ["walk", "hands"] }],
];

/** What a quick start gives: the parent answers each quick question as it shows, until no new one shows. */
export function quickOf(full: QAnswers, today = "2026-10-22"): QAnswers {
  let a: QAnswers = {};
  for (let k = 0; k < 10; k++) {
    const next = Object.fromEntries(quickVisible(a, today).filter((id) => full[id] !== undefined).map((id) => [id, full[id]]));
    if (Object.keys(next).length === Object.keys(a).length) return next;
    a = next;
  }
  throw new Error("the quick questions never settle");
}

