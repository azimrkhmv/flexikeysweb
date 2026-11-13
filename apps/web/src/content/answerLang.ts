import data from "./backend/languages.json";
import type { Lang } from "@/lib/translate";

// The language a question to the assistant is written in (B93): the answer follows the question, not the screen.
// Parents mix Uzbek and Russian and write both in either alphabet. The same words and rule as the server
// (apps/api/app/content/languages.json, `answer_lang` in assistant/safety.py; answerLang.test.ts checks the list).
// Uzbek in Cyrillic letters is Uzbek: the answer comes in Uzbek Latin, the app's Uzbek.

const WORDS = { uz: new Set(data.uz), uzCyrillic: new Set(data.uz_cyrillic), ruLatin: new Set(data.ru_latin), en: new Set(data.en) };
const APOSTROPHES = /[ʻʼ‘’`]/g;
const WORD = /\p{L}+(?:'\p{L}+)*/gu;
const CYRILLIC = /[а-яёўқғҳ]/;
const UZBEK_CYRILLIC = /[ўқғҳ]/;
const UZBEK_LATIN = /[og]'/;

/** The language most of the question's words are in; the screen's language when no word tells, or on a tie. */
export function answerLang(text: string, screen: Lang): Lang {
  const score: Record<Lang, number> = { uz: 0, ru: 0, en: 0 };
  for (const word of text.toLowerCase().replace(APOSTROPHES, "'").match(WORD) ?? []) {
    if (CYRILLIC.test(word)) score[WORDS.uzCyrillic.has(word) || UZBEK_CYRILLIC.test(word) ? "uz" : "ru"]++;
    else if (WORDS.uz.has(word) || UZBEK_LATIN.test(word)) score.uz++;
    else if (WORDS.ruLatin.has(word)) score.ru++;
    else if (WORDS.en.has(word)) score.en++;
  }
  const best = Math.max(score.uz, score.ru, score.en);
  if (best === 0 || score[screen] === best) return screen;
  return (["uz", "ru", "en"] as const).find((l) => score[l] === best)!;
}
