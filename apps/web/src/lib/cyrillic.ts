// Uzbek Latin → Uzbek Cyrillic. The app ships one Uzbek catalog (Latin); "Ўзбекча" is derived from it.
// ponytail: rule-based transliteration, needs a native-speaker pass for loanwords (spec §18); add exceptions to WORDS.

const APOS = "[ʻʼ'‘’`]";
const VOWELS = "aeiouAEIOUоОўЎ";

/** Whole words the rules get wrong. Lower-case keys. */
const WORDS: Record<string, string> = { flexikeys: "FlexiKeys", pro: "Pro", telegram: "Telegram", sms: "SMS" };

const PAIRS: [RegExp, string][] = [
  [new RegExp(`o${APOS}`, "g"), "ў"],
  [new RegExp(`O${APOS}`, "g"), "Ў"],
  [new RegExp(`g${APOS}`, "g"), "ғ"],
  [new RegExp(`G${APOS}`, "g"), "Ғ"],
  [/sh/g, "ш"], [/S[hH]/g, "Ш"],
  [/ch/g, "ч"], [/C[hH]/g, "Ч"],
  [/yo/g, "ё"], [/Y[oO]/g, "Ё"],
  [/yu/g, "ю"], [/Y[uU]/g, "Ю"],
  [/ya/g, "я"], [/Y[aA]/g, "Я"],
  [/ye/g, "е"], [/Y[eE]/g, "Е"],
  [new RegExp(APOS, "g"), "ъ"], // tutuq belgisi after the digraphs above took their apostrophes
];

const SINGLE: Record<string, string> = {
  a: "а", b: "б", c: "ц", d: "д", e: "е", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м", n: "н", o: "о",
  p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", w: "в", x: "х", y: "й", z: "з",
};

function word(w: string): string {
  const fixed = WORDS[w.toLowerCase()];
  if (fixed) return fixed;
  // Acronyms and brand-style words (GMFCS, FlexiKeys) stay Latin.
  if (/^[A-Z]{2,}$/.test(w) || /[a-z][A-Z]/.test(w)) return w;
  let s = w;
  for (const [re, to] of PAIRS) s = s.replace(re, to);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const lower = ch.toLowerCase();
    // "e" at the start of a word or after a vowel is "э".
    if (lower === "e" && (i === 0 || VOWELS.includes(s[i - 1]))) out += ch === "e" ? "э" : "Э";
    else if (SINGLE[lower]) out += ch === lower ? SINGLE[lower] : SINGLE[lower].toUpperCase();
    else out += ch;
  }
  return out;
}

/** Transliterates text; `{placeholders}` and URLs are left untouched. */
export function toCyrillic(text: string): string {
  return text.replace(/(\{\w+\}|https?:\/\/\S+)|([A-Za-zʻʼ'‘’`]+)/g, (m, keep: string | undefined, w: string | undefined) => (keep ? m : word(w!)));
}
