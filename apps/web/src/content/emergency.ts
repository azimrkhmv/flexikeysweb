import data from "./backend/emergency.json";

// Emergency words (spec §12): the assistant shows 103 before anything else. The same list as the server
// (apps/api/app/content/emergency.json; emergency.test.ts checks it). Matched in every language at once.

const WORDS = new RegExp(data.words.join("|"));
const APOSTROPHES = /[ʻʼ‘’`]/g;

export const isEmergency = (text: string) => WORDS.test(text.toLowerCase().replace(APOSTROPHES, "'"));
