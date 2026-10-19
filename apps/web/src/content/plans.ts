// Free and Pro (spec §14). The founders' PROPOSAL, placeholders until G3: the same values as the server's settings
// (apps/api app/settings.py free_*). Pro has no limits. Prices in so'm only.

/** What Free includes. */
export const FREE = { planDays: 7, offlineVideos: false, therapistSharing: false } as const;
export const TRIAL_DAYS = 7;
/** The parent is reminded this many days before the trial ends (spec §14 PROPOSAL). */
export const TRIAL_REMIND_DAYS = 2;
/** Placeholder until G3: so'm per month. */
export const PRO_PRICE_SOM = 49_000;
/** The rows of the Free / Pro table, in the spec's order: [key, Free, Pro] ("yes", "no" or a message key). */
export const PLAN_ROWS: [string, string, string][] = [
  ["intake", "yes", "yes"],
  ["plan", "plans.free.plan", "plans.pro.plan"],
  ["games", "plans.free.games", "plans.pro.games"],
  ["offline", "no", "yes"],
  ["findHelp", "yes", "yes"],
  ["assistant", "plans.free.assistant", "plans.pro.assistant"],
  ["therapist", "no", "yes"],
  ["summary", "yes", "yes"],
];
