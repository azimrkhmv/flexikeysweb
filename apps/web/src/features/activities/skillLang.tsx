"use client";

import { useState } from "react";
import { VOCAB } from "@/content/vocab";
import { SAY_TEXTS, showMe, showShape, type SAY_SHAPES } from "@/content/sayTexts";
import { usePlay } from "@/features/play/context";
import { parseGlyph } from "@/lib/games/glyph";
import { wordOf } from "@/lib/games/pools";
import { tokenize } from "@/lib/keys";
import { ChoiceEngine, PromptCard, type ChoiceSpec } from "./choice";
import { TypeRound } from "./keyboard";
import { denseSize, fitSize, sizeFor, useActT } from "./kit";
import { Series, type PlayerProps } from "./skillKit";

// Players of the new Language games (games spec 8 Nov 2026, §6.6). Words, sentences and texts are in the language the
// child is learning; the instructions around them are in the screen language.

const TEXT_BY_ID = Object.fromEntries(SAY_TEXTS.map((x) => [x.id, x]));

// ---------------------------------------------------------------- rhyme
export function RhymePlayer({ rounds, onDone }: PlayerProps<"rhyme">) {
  const ctx = usePlay();
  const t = useActT();
  const [specs] = useState(() =>
    rounds.map((r): ChoiceSpec => {
      const word = wordOf(r.prompt, ctx.learnLang) ?? "";
      const prompt = r.mode === "drop" ? t("act.skill.rhyme.drop", { word, sound: r.sound! }) : t("act.skill.rhyme", { word });
      return {
        answer: r.answer,
        options: r.options,
        prompt,
        speak: [
          [prompt, "ui"],
          [word, "learn"],
        ],
        size: denseSize(ctx, r.options.length, 130),
        stage: <PromptCard id={r.prompt} size={`min(${sizeFor(ctx, 140)}px, 17dvh)`} />,
      };
    }),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

// ---------------------------------------------------------------- word_builder
export function WordBuilderPlayer({ rounds, onDone }: PlayerProps<"word_builder">) {
  const ctx = usePlay();
  return (
    <Series
      rounds={rounds}
      onDone={onDone}
      render={(r, i, next, last) => {
        const word = VOCAB[r.item].word[ctx.learnLang];
        return <TypeRound key={i} word={word} mode="build" needed={tokenize(word, ctx.learnLang)} picture={r.picture ? r.item : undefined} keys={r.keys} index={i} total={rounds.length} last={last} next={next} />;
      }}
    />
  );
}

// ---------------------------------------------------------------- do_what_i_say
export function DoWhatISayPlayer({ rounds, onDone }: PlayerProps<"do_what_i_say">) {
  const ctx = usePlay();
  const t = useActT();
  const lang = ctx.learnLang;
  const [specs] = useState(() =>
    rounds.map((r): ChoiceSpec => {
      const size = r.mode === "text" ? fitSize(120, r.options.length) : denseSize(ctx, r.options.length, 130);
      if (r.mode === "text") {
        const x = TEXT_BY_ID[r.text!];
        const question = x.question[lang];
        return {
          answer: r.answer,
          options: r.options,
          prompt: question,
          // Summit's last step: the child reads the text; only the question is said.
          speak: r.read ? [[question, "learn"]] : [[x.text[lang], "learn"], [question, "learn"]],
          size,
          stage: (
            <div className="max-w-2xl rounded-fk-lg bg-sun-soft/50 px-5 py-3 shadow-inner" aria-label={t("act.skill.say.read")}>
              <p className="text-xl font-bold leading-relaxed text-ink sm:text-2xl short:text-lg short:leading-snug" lang={lang}>
                {x.text[lang]}
              </p>
            </div>
          ),
        };
      }
      let line: string;
      if (r.mode === "where") line = showMe(VOCAB[r.answer].word[lang], lang);
      else {
        const g = parseGlyph(r.answer);
        line = showShape(g.shape as keyof typeof SAY_SHAPES, g.color, r.mode === "size" ? (g.size === 2 ? "big" : "small") : null, lang);
      }
      return { answer: r.answer, options: r.options, prompt: line, speak: [[line, "learn"]], size };
    }),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}
