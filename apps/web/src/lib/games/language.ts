import { SAY_COLORS, SAY_SHAPES, SAY_TEXTS } from "@/content/sayTexts";
import { VOCAB } from "@/content/vocab";
import { DROPS, RHYMES } from "@/content/words";
import type { Lang } from "@/lib/i18n";
import { LAYOUTS, tokenize } from "@/lib/keys";
import { glyph, glyphId, parseGlyph } from "./glyph";
import { lookOf, PICTURES, wordId, wordOf } from "./pools";
import { one, sample, shuffled } from "./rng";
import type { Generator } from "./index";

// Round generators of the new Language games (games spec 8 Nov 2026, §6.6): rhyme, word_builder, do_what_i_say.
// Each language has its own word lists (content/words.ts); rhymes are never translated.

const distinct = (ids: readonly string[]) => new Set(ids.map(lookOf)).size === ids.length;

// ---------------------------------------------------------------- rhyme
export interface RhymeSettings {
  /** rhyme: which picture sounds like this one · drop: say the word without one sound. */
  mode: "rhyme" | "drop";
  options: number;
  /** rhyme: the wrong pictures start like the word, so the child must listen to its end · drop: the wrong pictures
   *  rhyme with the answer, so the child must listen to its start. */
  near?: boolean;
}
export interface RhymeRound {
  lang: Lang;
  mode: RhymeSettings["mode"];
  /** The word heard (and seen as a picture). */
  prompt: string;
  answer: string;
  options: string[];
  /** drop: the sound taken away. */
  sound?: string;
}
/** The rhyme family of a word id in its language (-1: none). */
export const rhymeFamily = (id: string) => {
  const [, lang, word] = id.split(":");
  return RHYMES[lang as Lang]?.findIndex((f) => f.some((x) => x.word === word)) ?? -1;
};
/** Every picture word of a language's rhyme lists and sound games, as ids. */
const rhymeWords = (lang: Lang) => [...new Set([...RHYMES[lang].flat(), ...DROPS[lang].flatMap((x) => [x.from, x.to])].map((x) => wordId(lang, x.word)))];
export const rhyme: Generator<RhymeSettings, RhymeRound> = {
  rounds: 4,
  make({ mode, options: n, near }, rng, lang) {
    const first = (id: string) => tokenize(wordOf(id, lang)!, lang)[0];
    if (mode === "drop") {
      const x = one(rng, DROPS[lang]);
      const prompt = wordId(lang, x.from.word);
      const answer = wordId(lang, x.to.word);
      // near: the words that rhyme with the answer first (rain: plane, chain), so the child must hear the start.
      const family = rhymeFamily(answer);
      const pool = shuffled(rng, rhymeWords(lang)).sort((x, y) => (near ? Number(rhymeFamily(y) === family && family >= 0) - Number(rhymeFamily(x) === family && family >= 0) : 0));
      const chosen = [answer];
      for (const w of pool) if (chosen.length < n && w !== prompt && distinct([...chosen, w, prompt])) chosen.push(w);
      return { lang, mode, prompt, answer, options: shuffled(rng, chosen), sound: x.sound };
    }
    const family = one(
      rng,
      RHYMES[lang].map((f, k) => k),
    );
    const [p, a] = sample(rng, RHYMES[lang][family], 2);
    const prompt = wordId(lang, p.word);
    const answer = wordId(lang, a.word);
    // One word from each of some other families, the ones starting like the prompt first when `near`.
    const others = shuffled(
      rng,
      RHYMES[lang].flatMap((f, k) => (k === family ? [] : [wordId(lang, one(rng, f).word)])),
    ).sort((x, y) => (near ? Number(first(y) === first(prompt)) - Number(first(x) === first(prompt)) : 0));
    const chosen = [answer];
    for (const w of others) if (chosen.length < n && distinct([...chosen, w, prompt])) chosen.push(w);
    return { lang, mode, prompt, answer, options: shuffled(rng, chosen) };
  },
  key: (r) => `${r.mode}|${r.prompt}|${r.answer}`,
  answers: (r) => {
    if (!distinct([...r.options, r.prompt])) return [0];
    if (r.mode === "drop") {
      const left = wordOf(r.prompt, r.lang)!.replace(r.sound!, "");
      return [r.options.filter((o) => wordOf(o, r.lang) === left).length];
    }
    const f = rhymeFamily(r.prompt);
    return [f < 0 ? 0 : r.options.filter((o) => rhymeFamily(o) === f).length];
  },
};

// ---------------------------------------------------------------- word_builder
export interface WordBuilderSettings {
  /** Letters in the word (Uzbek oʻ / gʻ are one letter). */
  min: number;
  max: number;
  /** The picture is shown; otherwise the word is only heard. */
  picture: boolean;
  /** Letters on the keyboard that are not in the word. */
  extra: number;
}
export interface WordBuilderRound {
  lang: Lang;
  /** A picture of the pools (its word in the language is the word to build). */
  item: string;
  picture: boolean;
  /** Keys on the keyboard: the word's letters and `extra` more. */
  keys: number;
}
/** Words a child can build: one word, every letter on the language's keyboard. */
export const buildable = (id: string, lang: Lang) => {
  const w = VOCAB[id]?.word[lang];
  return !!w && tokenize(w, lang).every((k) => LAYOUTS[lang].flat().includes(k));
};
export const wordBuilder: Generator<WordBuilderSettings, WordBuilderRound> = {
  rounds: 4,
  make({ min, max, picture, extra }, rng, lang) {
    const pool = Object.keys(VOCAB).filter((id) => VOCAB[id].emoji && buildable(id, lang) && tokenize(VOCAB[id].word[lang], lang).length >= min && tokenize(VOCAB[id].word[lang], lang).length <= max);
    const item = one(rng, pool);
    return { lang, item, picture, keys: new Set(tokenize(VOCAB[item].word[lang], lang)).size + extra };
  },
  key: (r) => r.item,
  // One way to build it: every letter of the word is on the keyboard.
  answers: (r) => [buildable(r.item, r.lang) ? 1 : 0],
};

// ---------------------------------------------------------------- do_what_i_say
export interface SaySettings {
  /** where: "Show me the cat" · color: a colour and a shape · size: a size, a colour and a shape · text: read a text
   *  (Tree: two sentences, Summit: three or four) and answer a question. */
  mode: "where" | "color" | "size" | "text";
  options: number;
  /** text: only the question is read aloud; the child reads the text. */
  read?: boolean;
  /** text: Tree texts (two sentences) or Summit texts (three or four). */
  texts?: 3 | 4;
}
export interface SayRound {
  lang: Lang;
  mode: SaySettings["mode"];
  /** text: the text's id. */
  text?: string;
  answer: string;
  options: string[];
  read: boolean;
}
const SHAPES = Object.keys(SAY_SHAPES) as (keyof typeof SAY_SHAPES)[];
/** The features a round asks about must all match: one option does. */
const fits = (mode: SaySettings["mode"], answer: string, o: string) => {
  if (mode === "where" || mode === "text") return o === answer;
  const [a, b] = [parseGlyph(answer), parseGlyph(o)];
  return a.shape === b.shape && a.color === b.color && (mode === "color" || a.size === b.size);
};
export const doWhatISay: Generator<SaySettings, SayRound> = {
  rounds: 4,
  make({ mode, options: n, read = false, texts = 3 }, rng, lang) {
    if (mode === "text") {
      const t = one(rng, SAY_TEXTS.filter((x) => x.tier === texts));
      return { lang, mode, text: t.id, answer: t.answer, options: shuffled(rng, t.options.slice(0, n)), read };
    }
    if (mode === "where") {
      const answer = one(rng, PICTURES);
      const options = [answer];
      for (const x of shuffled(rng, PICTURES)) if (options.length < n && !options.some((o) => wordOf(o, lang) === wordOf(x, lang)) && distinct([...options, x])) options.push(x);
      return { lang, mode, answer, options: shuffled(rng, options), read };
    }
    const size = () => (mode === "size" ? one(rng, [0, 2] as const) : 1);
    const make = () => glyphId(glyph({ shape: one(rng, SHAPES), color: one(rng, SAY_COLORS), size: size() }));
    const answer = make();
    const a = parseGlyph(answer);
    // Wrong options share some features with the answer: same colour, same shape, (same size), never all of them.
    const near = () => {
      const g = { ...a, tag: undefined };
      const change = one(rng, mode === "size" ? (["shape", "color", "size"] as const) : (["shape", "color"] as const));
      if (change === "shape") g.shape = one(rng, SHAPES.filter((s) => s !== a.shape));
      if (change === "color") g.color = one(rng, SAY_COLORS.filter((c) => c !== a.color));
      if (change === "size") g.size = a.size === 0 ? 2 : 0;
      return glyphId(g);
    };
    const options = [answer];
    for (let k = 0; options.length < n && k < 200; k++) {
      const o = k < 100 ? near() : make();
      if (!options.includes(o) && !fits(mode, answer, o)) options.push(o);
    }
    return { lang, mode, answer, options: shuffled(rng, options), read };
  },
  key: (r) => `${r.mode}|${r.text ?? r.answer}`,
  answers: (r) => [distinct(r.options) ? r.options.filter((o) => fits(r.mode, r.answer, o)).length : 0],
};
