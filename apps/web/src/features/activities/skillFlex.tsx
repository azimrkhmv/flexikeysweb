"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { ItemArt, itemLabel, times } from "@/components/ItemArt";
import { VOCAB } from "@/content/vocab";
import { usePlay } from "@/features/play/context";
import { colorWord, parseCard, sortBox, type SortRule } from "@/lib/games/flexibility";
import { ChoiceEngine, PromptCard, type ChoiceSpec } from "./choice";
import { denseSize, fitSize, sizeFor, useActT } from "./kit";
import type { PlayerProps } from "./skillKit";

// Players of the new Flexibility games (games spec 8 Nov 2026, §6.3).

// ---------------------------------------------------------------- switch_sort
/** One card after another into the boxes. A yellow frame: sort by colour; a frame with stars: sort by shape. */
export function SwitchSortPlayer({ rounds, onDone }: PlayerProps<"switch_sort">) {
  const ctx = usePlay();
  const t = useActT();
  const r = rounds[0];
  const [specs] = useState(() =>
    r.cards.map(
      (card, i): ChoiceSpec => ({
        answer: sortBox(r.boxes, card, r.rules[i])!,
        options: r.boxes,
        prompt: t(r.said ? `act.skill.switch.${r.rules[i]}` : "act.skill.switch.frame"),
        size: fitSize(Math.round(150 * ctx.profile.targetScale), r.boxes.length),
        stage: <RuleFrame card={card} rule={r.rules[i]} />,
      }),
    ),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

/** The card in its frame: thick yellow for colour, lavender with a star in each corner for shape. */
function RuleFrame({ card, rule }: { card: string; rule: SortRule }) {
  const ctx = usePlay();
  const t = useActT();
  const s = `min(${sizeFor(ctx, 130)}px, 17dvh)`;
  return (
    <div
      className={`relative grid place-items-center rounded-fk-lg bg-surface-2 shadow-inner ${rule === "color" ? "border-[10px] border-sun" : "border-[10px] border-dotted border-[#b3a8e8]"}`}
      style={{ width: s, height: s }}
      role="img"
      aria-label={`${itemLabel(card, ctx.learnLang, t)}. ${t(`act.skill.switch.${rule}`)}`}
    >
      <ItemArt id={card} size={times(s, 0.62)} />
      {rule === "shape" &&
        ["-left-4 -top-4", "-right-4 -top-4", "-left-4 -bottom-4", "-right-4 -bottom-4"].map((at) => (
          <span key={at} className={`absolute ${at} text-2xl leading-none`} aria-hidden>
            ⭐
          </span>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------- opposite
export function OppositePlayer({ rounds, onDone }: PlayerProps<"opposite">) {
  const ctx = usePlay();
  const t = useActT();
  const [specs] = useState(() =>
    rounds.map((r): ChoiceSpec => {
      const size = denseSize(ctx, r.options.length, 130);
      if (r.ink)
        return {
          answer: r.answer,
          options: r.options,
          prompt: t("act.skill.opposite.ink"),
          size,
          stage: <InkWord word={colorWord(r.prompt, ctx.learnLang)} ink={VOCAB[r.ink].color!} />,
        };
      return { answer: r.answer, options: r.options, prompt: t("act.skill.opposite"), size, stage: <PromptCard id={r.prompt} size={`min(${sizeFor(ctx, 150)}px, 18dvh)`} /> };
    }),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

/** A colour word written in another colour (a thin outline keeps light inks readable). */
function InkWord({ word, ink }: { word: string; ink: string }) {
  return (
    <p
      className="rounded-fk-lg bg-surface-2 px-8 py-4 text-center font-extrabold uppercase leading-none shadow-inner"
      style={{ color: ink, fontSize: "clamp(2.5rem, 9vw, 4.5rem)", WebkitTextStroke: "1.5px rgb(39 64 107 / .35)" }}
    >
      {word}
    </p>
  );
}

// ---------------------------------------------------------------- secret_rule
/**
 * A card to put under one of the four cards on the table. The rule (colour, shape, number, size) is never said and
 * changes without warning. A right card glows; a card that does not fit only slides back softly.
 */
export function SecretRulePlayer({ rounds, onDone }: PlayerProps<"secret_rule">) {
  const ctx = usePlay();
  const t = useActT();
  const r = rounds[0];
  const [misses, setMisses] = useState(0);
  const size = fitSize(Math.round(130 * ctx.profile.targetScale), 4);
  const specs = r.cards.map(
    (card, i): ChoiceSpec => ({
      answer: r.keys.find((k) => parseCard(k)[r.rules[i]] === parseCard(card)[r.rules[i]])!,
      options: r.keys,
      prompt: t("act.skill.secret"),
      size,
      quietMiss: true,
      onPick: (_, correct) => !correct && setMisses((m) => m + 1),
      stage: <SlideBack id={card} misses={misses} />,
    }),
  );
  return <ChoiceEngine rounds={specs} onDone={onDone} />;
}

/** The card to place: on each miss it slides towards the table and back. */
function SlideBack({ id, misses }: { id: string; misses: number }) {
  const ctx = usePlay();
  const s = `min(${sizeFor(ctx, 130)}px, 17dvh)`;
  return (
    <motion.div
      key={misses}
      className="grid place-items-center rounded-fk-lg border-4 border-white bg-surface-2 shadow-soft"
      style={{ width: s, height: s }}
      initial={{ y: 0 }}
      animate={{ y: misses ? [0, 26, 0] : 0 }}
      transition={{ duration: 0.55, ease: "easeInOut" }}
    >
      <ItemArt id={id} size={times(s, 0.8)} />
    </motion.div>
  );
}
