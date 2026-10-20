import data from "./backend/topics.json";

// What a question to the assistant was about, for the therapist's summary (spec §12: topics and warnings, never the
// chat). The same words as the server (apps/api/app/content/topics.json; topics.test.ts checks it).

const TOPICS = Object.entries(data.topics).map(([topic, words]) => [topic, new RegExp(words.join("|"))] as const);
const APOSTROPHES = /[ʻʼ‘’`]/g;

/** Every topic the question touches; "other" when none. */
export function topicsOf(text: string): string[] {
  const t = text.toLowerCase().replace(APOSTROPHES, "'");
  const found = TOPICS.filter(([, re]) => re.test(t)).map(([topic]) => topic);
  return found.length ? found : ["other"];
}
