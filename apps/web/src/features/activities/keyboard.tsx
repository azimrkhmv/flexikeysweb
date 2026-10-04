"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/i18n";
import { markAccept, usePlay } from "@/features/play/context";
import { Target, type SelectInfo } from "@/features/play/Target";
import { ActionButton, answer, Frame, pick, shuffle, useActT, useClock, useHint, useLater } from "./kit";
import type { EngineProps } from "./registry";

// Adaptive keyboard (PRD §9.4) + the `type` activity (letter find, ghost-word build, listen & type).

export const LAYOUTS: Record<Lang, string[][]> = {
  en: ["qwertyuiop", "asdfghjkl", "zxcvbnm"].map((r) => [...r]),
  uz: [[..."qwertyuiop"], [..."asdfghjkl"], [..."zxcvbnm", "oʻ", "gʻ"]],
  ru: ["йцукенгшщзхъ", "фывапролджэ", "ячсмитьбюё"].map((r) => [...r]),
};

/** Splits a word into keyboard tokens. Uzbek "oʻ"/"gʻ" are single keys; apostrophe variants are normalized. */
export function tokenize(word: string, lang: Lang): string[] {
  const w = word.toLowerCase().normalize("NFC");
  if (lang !== "uz") return [...w];
  return w.replace(/([og])['‘’ʼ`]/g, "$1ʻ").match(/[og]ʻ|./gu) ?? [];
}

/** Needed keys plus a few stable distractors, in layout order (reduced keyboard). */
export function reducedKeys(lang: Lang, needed: string[], total = 8): string[] {
  const all = LAYOUTS[lang].flat();
  const need = new Set(needed.filter((k) => all.includes(k)));
  const rest = all.filter((k) => !need.has(k));
  const want = Math.max(0, total - need.size);
  let seed = [...need].join("").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const extra = new Set<string>();
  while (extra.size < Math.min(want, rest.length)) {
    extra.add(rest[seed % rest.length]);
    seed += 7;
  }
  return all.filter((k) => need.has(k) || extra.has(k));
}

// QWERTY physical positions → ЙЦУКЕН, so Russian works on a Latin hardware layout too.
const RU_BY_CODE: Record<string, string> = Object.fromEntries(
  [
    ["KeyQ", "й"], ["KeyW", "ц"], ["KeyE", "у"], ["KeyR", "к"], ["KeyT", "е"], ["KeyY", "н"], ["KeyU", "г"], ["KeyI", "ш"], ["KeyO", "щ"], ["KeyP", "з"], ["BracketLeft", "х"], ["BracketRight", "ъ"],
    ["KeyA", "ф"], ["KeyS", "ы"], ["KeyD", "в"], ["KeyF", "а"], ["KeyG", "п"], ["KeyH", "р"], ["KeyJ", "о"], ["KeyK", "л"], ["KeyL", "д"], ["Semicolon", "ж"], ["Quote", "э"],
    ["KeyZ", "я"], ["KeyX", "ч"], ["KeyC", "с"], ["KeyV", "м"], ["KeyB", "и"], ["KeyN", "т"], ["KeyM", "ь"], ["Comma", "б"], ["Period", "ю"], ["Backquote", "ё"],
  ],
);

const narrowQuery = "(max-width: 639px)";
function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(narrowQuery);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(narrowQuery).matches,
    () => false,
  );
}

export function AdaptiveKeyboard({
  lang,
  needed,
  expected,
  hint,
  onKey,
  reduced: forceReduced,
  disabled,
}: {
  lang: Lang;
  /** Keys the current item uses — kept in the reduced set. */
  needed: string[];
  /** Next expected key (lets the physical keyboard type "oʻ" with a plain "o"). */
  expected?: string;
  /** Key to highlight as a hint. */
  hint?: string | null;
  onKey: (key: string, info: SelectInfo) => void;
  reduced?: boolean;
  disabled?: boolean;
}) {
  const ctx = usePlay();
  const t = useActT();
  const narrow = useNarrow();
  const p = ctx.profile;
  const reduced = forceReduced ?? (p.hintLevel >= 2 || narrow);
  const rows = reduced ? [reducedKeys(lang, needed)] : LAYOUTS[lang];
  const size = Math.max(64, Math.round(76 * p.keyScale));
  // Physical key press → same debounce rule as on-screen keys (FR-KBD-3), then onKey.
  const pressRef = useRef<(k: string) => void>(null);
  useEffect(() => {
    pressRef.current = (k) => {
      const since = ctx.lastAccept.current === null ? null : performance.now() - ctx.lastAccept.current;
      if (since !== null && since < ctx.profile.debounceMs) return ctx.emit({ type: "debounced", target: k, pointerType: "keyboard" });
      markAccept(ctx);
      onKey(k, { pointerType: "keyboard" });
    };
  });

  // Physical keyboard in parallel (FR-KBD-4). Space/Enter are left to scanning and focused buttons.
  useEffect(() => {
    if (disabled) return;
    const all = LAYOUTS[lang].flat();
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || e.key === " ") return;
      if (document.querySelector('[aria-modal="true"]')) return; // pause menu / My Voice open over the game
      let k = e.key.toLowerCase();
      if (lang === "ru" && !/[а-яё]/.test(k)) k = RU_BY_CODE[e.code] ?? k;
      // ponytail: "o"/"g" count as "oʻ"/"gʻ" when that is the expected key — hardware keyboards have no ʻ key.
      if (lang === "uz" && expected === `${k}ʻ`) k = expected;
      if (!all.includes(k)) return;
      e.preventDefault();
      pressRef.current?.(k);
    };
    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
  }, [lang, expected, disabled]);

  return (
    <div role="group" aria-label={t("act.keyboard")} className="flex w-full flex-col items-center rounded-fk-lg bg-surface-2 p-3 shadow-inner" style={{ gap: p.spacing, touchAction: "none" }}>
      {rows.map((row, r) => (
        <div key={r} className="flex flex-wrap justify-center" style={{ gap: p.spacing, paddingLeft: reduced ? 0 : r * size * 0.25 }}>
          {row.map((k) => {
            const isHint = hint === k;
            return (
              <Target
                key={k}
                label={k}
                targetId={k}
                disabled={disabled}
                onSelect={(info) => onKey(k, info)}
                pulse={isHint && p.hintLevel >= 2}
                className={`grid place-items-center rounded-2xl border-b-4 text-3xl font-extrabold transition-[width,height] duration-300 ease-out ${
                  isHint ? "border-[#e8b930] bg-sun text-ink" : "border-line bg-surface text-ink hover:bg-sky-soft"
                }`}
                style={{ width: size, height: size, minWidth: 64, minHeight: 64 }}
              >
                {k}
              </Target>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- type activity
export function TypeActivity({ activity, onDone }: EngineProps<"type">) {
  const ctx = usePlay();
  const [words] = useState(() => {
    const list = activity.words[ctx.learnLang];
    return activity.mode === "letter" ? pick(list, Math.min(5, list.length)) : shuffle(list).slice(0, 4);
  });
  const [i, setI] = useState(0);
  const last = i + 1 >= words.length;
  const needed = [...new Set(words.flatMap((w) => tokenize(w, ctx.learnLang)))];
  return (
    <TypeRound
      key={i}
      word={words[i]}
      mode={activity.mode}
      needed={activity.mode === "letter" ? needed : tokenize(words[i], ctx.learnLang)}
      index={i}
      total={words.length}
      last={last}
      next={() => (last ? onDone() : setI(i + 1))}
    />
  );
}

function TypeRound({ word, mode, needed, index, total, last, next }: { word: string; mode: "letter" | "word" | "listen"; needed: string[]; index: number; total: number; last: boolean; next: () => void }) {
  const ctx = usePlay();
  const t = useActT();
  const clock = useClock();
  const tokens = tokenize(word, ctx.learnLang);
  const [pos, setPos] = useState(0);
  const expected = tokens[pos];
  const hint = useHint(() => ctx.say(expected ?? word, ctx.learnLang));
  const later = useLater();
  const solved = pos >= tokens.length;
  const prompt = t(mode === "letter" ? "act.type.letter" : mode === "word" ? "act.type.word" : "act.type.listen");

  const onKey = (k: string, info: SelectInfo) => {
    if (solved) return;
    const correct = k === expected;
    const finished = correct && pos + 1 === tokens.length;
    answer(ctx, { type: "key", target: expected, actual: k, correct, latencyMs: clock.ms(), info, quiet: !finished });
    if (!correct) return hint.miss();
    clock.reset();
    setPos(pos + 1);
    if (finished && mode !== "letter") later(() => ctx.say(word, ctx.learnLang), 600);
  };

  const ghost = mode === "word" || (mode === "listen" && hint.show);
  return (
    <Frame
      prompt={prompt}
      speak={[[prompt, "ui"], [word, "learn"]]}
      speakKey={`r${index}`}
      done={index + (solved ? 1 : 0)}
      total={total}
      action={solved && <ActionButton label={t(last ? "act.done" : "act.next")} onSelect={next} pulse />}
    >
      {mode === "letter" ? (
        <span className={`grid size-40 place-items-center rounded-fk-lg text-8xl font-extrabold text-ink shadow-soft ${solved ? "bg-teal-soft" : "bg-sun-soft"}`}>{word}</span>
      ) : (
        <div className="flex flex-wrap justify-center gap-2" aria-label={word}>
          {tokens.map((ch, k) => (
            <span
              key={k}
              className={`grid h-24 min-w-20 place-items-center rounded-2xl border-b-4 px-3 text-6xl font-extrabold ${
                k < pos ? "fk-pop border-teal bg-teal-soft text-ink" : k === pos ? "border-sky bg-surface text-ink/25" : "border-line bg-surface-2 text-ink/20"
              }`}
            >
              {k < pos || ghost ? ch : " "}
            </span>
          ))}
        </div>
      )}
      <AdaptiveKeyboard lang={ctx.learnLang} needed={needed} expected={expected} hint={!solved && (hint.show || ctx.profile.hintLevel >= 3) ? expected : null} onKey={onKey} disabled={solved} />
    </Frame>
  );
}
