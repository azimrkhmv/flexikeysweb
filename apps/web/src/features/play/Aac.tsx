"use client";

import { useEffect, useState } from "react";
import { Delete, Volume2, X } from "lucide-react";
import { AAC_CARDS, AAC_CATEGORIES, AAC_QUICK, aacCard, CUSTOM_PREFIX, wordClass, type WordClass } from "@/content/aac";
import { api, sel, useDb } from "@/lib/api";
import { hasVoice, speak, stopSpeech, playClip } from "@/lib/audio";
import { useT } from "@/lib/i18n";
import type { Child } from "@/lib/types";
import { Target } from "./Target";

const MAX_STRIP = 10;
/** Fixed columns on every screen: a card keeps its place across phone, tablet and PC, and never moves when the
 * adaptive engine changes target size (motor planning — the child learns where a word lives, like typing). */
const COLS = 4;
const BORDER: Record<WordClass, string> = {
  person: "border-sun",
  action: "border-leaf",
  describe: "border-sky",
  thing: "border-peach",
  social: "border-lavender",
};

/** AAC "My Voice": picture cards → sentence strip → spoken in the child's UI language (PRD §9.11). */
export function Aac({ child }: { child: Child }) {
  const db = useDb();
  const lang = child.uiLang;
  const t = useT(lang);
  const [cat, setCat] = useState("core");
  const [strip, setStrip] = useState<string[]>([]); // card ids; labels derive from the current language
  const [confirm, setConfirm] = useState<{ sentence: string; plain: string; lang: string } | null>(null);
  const custom = sel.aacCustomCards(db, child.id);

  // FR-AAC-1: a language change re-renders labels and cancels speech already playing.
  useEffect(() => stopSpeech, [lang]);

  const card = (id: string) => aacCard(id, lang, custom);
  const quick: string[] = [...AAC_QUICK];
  const cards: [string, string][] = [
    ...AAC_CARDS.filter((c) => c.category === cat && !quick.includes(c.id)).map((c) => [c.id, c.category] as [string, string]),
    ...custom.filter((c) => c.category === cat).map((c) => [`${CUSTOM_PREFIX}${c.id}`, c.category] as [string, string]),
  ];
  const labels = strip.map((id) => card(id)?.label ?? "").filter(Boolean);

  /** `clips`: when every word has the parent's recording (or the device has no voice for this language), the
   * sentence is played in the parent's voice instead of going silent. */
  const say = (sentence: string, clips: string[] = []) => {
    if (clips.length && (clips.length === strip.length || hasVoice(lang) === false)) playClip(...clips);
    else speak(sentence, lang);
    void api.aacLog(strip, sentence, lang).catch(() => {});
    setConfirm(null);
  };

  // The child's own words are spoken at once — never held back by the network or an extra choice.
  // An AI-polished sentence, if any, is only offered afterwards.
  const speakStrip = async () => {
    if (!labels.length) return;
    const plain = labels.join(" ");
    say(plain, clips());
    const res = await api.aacCompose(labels, lang).catch(() => null);
    const norm = (s: string) => s.toLowerCase().replace(/[.!?,]/g, "").trim();
    if (res?.ai && norm(res.sentence) !== norm(plain)) setConfirm({ sentence: res.sentence, plain, lang });
  };

  const clips = () => strip.map((id) => card(id)?.audio).filter((a): a is string => !!a);

  const tap = (id: string) => {
    const c = card(id);
    if (!c || strip.length >= MAX_STRIP) return;
    setStrip((s) => [...s, id]);
    setConfirm(null);
    if (c.audio) playClip(c.audio); // the parent's own voice
    else speak(c.label, lang);
  };

  const cardButton = (id: string, category: string) => {
    const c = card(id);
    if (!c) return null;
    return (
      <Target
        key={id}
        label={c.label}
        onSelect={() => tap(id)}
        className={`flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-3xl border-[6px] ${BORDER[wordClass(id, category)]} bg-surface/95 p-2 font-extrabold text-ink shadow-soft`}
      >
        {c.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, same-origin card photo
          <img src={c.photo} alt="" className="aspect-square w-3/5 rounded-2xl object-cover" />
        ) : (
          <span className="text-[clamp(2rem,9vw,4.5rem)] leading-none">{c.emoji}</span>
        )}
        <span className="text-center text-[clamp(0.95rem,2.6vw,1.35rem)] leading-tight">{c.label}</span>
      </Target>
    );
  };
  const grid = { gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      {/* sentence strip */}
      <section className="flex flex-wrap items-center gap-3 rounded-fk-lg border-4 border-white bg-surface/95 p-3 shadow-soft">
        <div className="flex min-h-24 min-w-0 flex-1 items-center gap-2 overflow-x-auto" aria-live="polite">
          {strip.length === 0 && <p className="px-3 text-lg font-bold text-muted">{t("aac.empty")}</p>}
          {strip.map((id, i) => {
            const c = card(id);
            return c ? (
              <span key={i} className="flex shrink-0 flex-col items-center rounded-2xl bg-sky-soft px-3 py-2">
                {c.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private, same-origin card photo
                  <img src={c.photo} alt="" className="size-9 rounded-lg object-cover" />
                ) : (
                  <span className="text-3xl">{c.emoji}</span>
                )}
                <span className="text-sm font-bold text-ink">{c.label}</span>
              </span>
            ) : null;
          })}
        </div>
        <div className="flex gap-2">
          <Target label={t("aac.backspace")} onSelect={() => setStrip((s) => s.slice(0, -1))} disabled={!strip.length} className="grid place-items-center rounded-3xl bg-surface-2 text-ink-2 disabled:opacity-40">
            <Delete className="size-8" aria-hidden />
          </Target>
          <Target label={t("aac.clear")} onSelect={() => setStrip([])} disabled={!strip.length} className="grid place-items-center rounded-3xl bg-surface-2 text-ink-2 disabled:opacity-40">
            <X className="size-8" aria-hidden />
          </Target>
          <Target label={t("aac.speak")} onSelect={speakStrip} disabled={!strip.length} className="flex items-center gap-2 rounded-3xl bg-teal px-6 text-xl font-extrabold text-white shadow-soft disabled:opacity-40">
            <Volume2 className="size-8" aria-hidden /> {t("aac.speak")}
          </Target>
        </div>
      </section>

      {/* quick row: yes / no / help / stop, always in the same place */}
      <div className="mx-auto grid w-full max-w-3xl gap-3" style={grid}>
        {AAC_QUICK.map((id) => cardButton(id, "core"))}
      </div>

      {confirm && confirm.lang === lang && (
        <section className="flex flex-wrap items-center gap-3 rounded-fk-lg border-4 border-teal bg-teal-soft p-4" role="dialog" aria-label={t("aac.confirm")}>
          <p className="min-w-0 flex-1 text-2xl font-extrabold text-ink">“{confirm.sentence}”</p>
          <Target label={t("aac.sayThis")} onSelect={() => say(confirm.sentence)} className="rounded-3xl bg-teal px-5 text-lg font-extrabold text-white">
            {t("aac.sayThis")}
          </Target>
          <Target label={t("aac.sayMine")} onSelect={() => say(confirm.plain, clips())} className="rounded-3xl bg-surface px-5 text-lg font-extrabold text-ink">
            {t("aac.sayMine")}
          </Target>
        </section>
      )}

      {/* categories */}
      <nav aria-label={t("aac.categories")} className="flex gap-2 overflow-x-auto pb-1">
        {AAC_CATEGORIES.map((c) => (
          <Target
            key={c.id}
            label={c.label[lang]}
            selected={cat === c.id}
            onSelect={() => setCat(c.id)}
            className={`flex shrink-0 flex-col items-center justify-center rounded-3xl border-4 px-4 font-bold text-ink ${cat === c.id ? "border-teal bg-teal-soft" : "border-white bg-surface/90"}`}
          >
            <span className="text-2xl">{c.emoji}</span>
            <span className="text-sm">{c.label[lang]}</span>
          </Target>
        ))}
      </nav>

      {/* cards: fixed 4-column grid, same place on every device */}
      <div className="mx-auto grid w-full max-w-3xl gap-3" style={grid}>
        {cards.map(([id, category]) => cardButton(id, category))}
      </div>
    </div>
  );
}
