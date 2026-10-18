// The daily question list (spec §10): one short question a day adds small, steady updates to the child's profile
// between the 3-month re-intakes. Each one asks about today and updates one ability question of the intake (A5.5).
// Never a health question. Answers use the intake's ability scale: 2 = yes, 1 = sometimes or with help, 0 = not yet.

export const DAILY_QUESTIONS = [
  { id: "D1", updates: "P18" },
  { id: "D2", updates: "P19" },
  { id: "D3", updates: "P20" },
  { id: "D4", updates: "P23" },
  { id: "D5", updates: "P24" },
  { id: "D6", updates: "P27" },
  { id: "D7", updates: "P30" },
  { id: "D8", updates: "P31" },
] as const;
export type DailyQuestionId = (typeof DAILY_QUESTIONS)[number]["id"];

/** The question of the day (YYYY-MM-DD): the list in turn, the same for everyone on that day. */
export const dailyQuestionOn = (date: string) => DAILY_QUESTIONS[Math.floor(Date.parse(date) / 86_400_000) % DAILY_QUESTIONS.length];
