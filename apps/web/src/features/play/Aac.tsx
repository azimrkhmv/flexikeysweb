"use client";

import { useEffect, useState } from "react";
import { Delete, Volume2, X } from "lucide-react";
import { AAC_CARDS, AAC_CATEGORIES, aacCard, CUSTOM_PREFIX } from "@/content/aac";
import { api, sel, useDb } from "@/lib/api";
import { speak, stopSpeech, playClip } from "@/lib/audio";
import { useT } from "@/lib/i18n";
import type { Child } from "@/lib/types";
import { Target } from "./Target";
import { usePlay } from "./context";

const MAX_STRIP = 10;

/** AAC "My Voice": picture cards → sentence strip → spoken in the child's UI language (PRD §9.11). */
export function Aac({ child }: { child: Child }) {
  const db = useDb();
  const lang = child.uiLang;
  const t = useT(lang);
  const { profile } = usePlay();
  const [cat, setCat] = useState("core");
  const [strip, setStrip] = useState<string[]>([]); // card ids; labels derive from the current language
  const [confirm, setConfirm] = useState<{ sentence: string; plain: string; lang: string } | null>(null);
  const custom = sel.aacCustomCards(db, child.id);

  // FR-AAC-1: a language change re-renders labels and cancels speech already playing.
  useEffect(() => stopSpeech, [lang]);

  const card = (id: string) => aacCard(id, lang, custom);
  const cards = [
    ...AAC_CARDS.filter((c) => c.category === cat).map((c) => c.id),
    ...custom.filter((c) => c.category === cat).map((c) => `${CUSTOM_PREFIX}${c.id}`),
  ];
  const labels = strip.map((id) => card(id)?.label ?? "").filter(Boolean);

  const say = (sentence: string) => {
    speak(sentence, lang);
    void api.aacLog(strip, sentence, lang).catch(() => {});
    setConfirm(null);
  };

  // The child's own words are spoken at once — never held back by the network or an extra choice.
  // An AI-polished sentence, if any, is only offered afterwards.
  const speakStrip = async () => {
    if (!labels.length) return;
    const plain = labels.join(" ");
    say(plain);
    const res = await api.aacCompose(labels, lang).catch(() => null);
    const norm = (s: string) => s.toLowerCase().replace(/[.!?,]/g, "").trim();
    if (res?.ai && norm(res.sentence) !== norm(plain)) setConfirm({ sentence: res.sentence, plain, lang });
  };

  const size = Math.round(120 * profile.targetScale);

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

      {confirm && confirm.lang === lang && (
        <section className="flex flex-wrap items-center gap-3 rounded-fk-lg border-4 border-teal bg-teal-soft p-4" role="dialog" aria-label={t("aac.confirm")}>
          <p className="min-w-0 flex-1 text-2xl font-extrabold text-ink">“{confirm.sentence}”</p>
          <Target label={t("aac.sayThis")} onSelect={() => say(confirm.sentence)} className="rounded-3xl bg-teal px-5 text-lg font-extrabold text-white">
            {t("aac.sayThis")}
          </Target>
          <Target label={t("aac.sayMine")} onSelect={() => say(confirm.plain)} className="rounded-3xl bg-surface px-5 text-lg font-extrabold text-ink">
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

      {/* cards */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))` }}>
        {cards.map((id) => {
          const c = card(id)!;
          return (
            <Target
              key={id}
              label={c.label}
              onSelect={() => {
                if (strip.length >= MAX_STRIP) return;
                setStrip((s) => [...s, id]);
                setConfirm(null);
                if (c.audio) playClip(c.audio); // the parent's own voice
                else speak(c.label, lang);
              }}
              className="flex flex-col items-center justify-center gap-1 rounded-3xl border-4 border-white bg-surface/95 p-3 font-extrabold text-ink shadow-soft"
              style={{ minHeight: size }}
            >
              {c.photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- private, same-origin card photo
                <img src={c.photo} alt="" className="rounded-2xl object-cover" style={{ width: size * 0.55, height: size * 0.55 }} />
              ) : (
                <span style={{ fontSize: size * 0.4 }}>{c.emoji}</span>
              )}
              <span className="text-center text-base leading-tight">{c.label}</span>
            </Target>
          );
        })}
      </div>
    </div>
  );
}
