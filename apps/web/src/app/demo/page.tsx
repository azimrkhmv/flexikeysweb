"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { LangSwitch, Logo } from "@/components/brand";
import { Mascot } from "@/components/Mascot";
import { Chip, LinkButton } from "@/components/ui";
import { LEVEL_BY_ID } from "@/content/levels";
import { ENGINES, type EngineProps } from "@/features/activities/registry";
import { DEMO_PLAY, PlayContext, type PlayCtx } from "@/features/play/context";
import { sfx, unlockAudio } from "@/lib/audio";
import { useLang, useT } from "@/lib/i18n";
import type { MascotMood } from "@/lib/types";

// "Try a demo" (PRD §9.3 SHOULD): a few real engines, default profile, nothing is stored.
const GAMES = [
  { level: "animals", activity: "animals-listen", key: "g_animals", arch: "A" },
  { level: "colors", activity: "colors-seq", key: "g_colors", arch: "B" },
  { level: "nature", activity: "nature-path", key: "g_path", arch: "C" },
  { level: "nature", activity: "nature-scene", key: "g_nature", arch: "D" },
  { level: "animals", activity: "animals-puzzle", key: "g_puzzle", arch: "E" },
  { level: "fruits", activity: "fruits-same", key: "g_fruits", arch: "A" },
] as const;

export default function DemoPage() {
  const [lang] = useLang();
  const t = useT();
  const [game, setGame] = useState(0);
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);
  const [mood, setMood] = useState<{ m: MascotMood; n: number }>({ m: "wave", n: 0 });
  const g = GAMES[game];
  const activity = LEVEL_BY_ID[g.level].activities.find((a) => a.id === g.activity)!;
  const Engine = ENGINES[activity.kind] as ComponentType<EngineProps>;

  useEffect(() => {
    if (mood.m === "calm" || mood.m === "celebrate") return;
    const id = setTimeout(() => setMood((x) => ({ ...x, m: "calm" })), 1800);
    return () => clearTimeout(id);
  }, [mood]);

  const ctx: PlayCtx = useMemo(
    () => ({
      ...DEMO_PLAY,
      learnLang: lang,
      uiLang: lang,
      levelId: g.level,
      activityId: g.activity,
      react: (k) => {
        sfx(k === "success" ? "success" : "soft");
        setMood((x) => ({ m: k === "success" ? "happy" : "curious", n: x.n + 1 }));
      },
    }),
    [lang, g.level, g.activity],
  );

  const choose = (i: number) => {
    setGame(i);
    setFinished(false);
    setRun((r) => r + 1);
    setMood((x) => ({ m: "wave", n: x.n + 1 }));
  };

  return (
    <div className="min-h-dvh bg-bg" onPointerDownCapture={unlockAudio}>
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
        <Logo />
        <div className="ml-auto flex items-center gap-2">
          <LangSwitch compact />
          <LinkButton href="/signup" size="sm">
            {t("nav.signup")}
          </LinkButton>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mb-5 text-center">
          <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{t("act.demo.title")}</h1>
          <p className="mt-2 text-ink-2">{t("act.demo.subtitle")}</p>
        </div>

        <nav aria-label={t("act.demo.pick")} className="mb-5 flex gap-3 overflow-x-auto pb-2">
          {GAMES.map((x, i) => (
            <button
              key={x.activity}
              type="button"
              onClick={() => choose(i)}
              aria-pressed={i === game}
              className={`flex min-h-20 min-w-44 shrink-0 items-center gap-3 rounded-fk border-2 px-4 py-3 text-left transition ${
                i === game ? "border-teal bg-surface shadow-soft" : "border-transparent bg-surface/60 hover:bg-surface"
              }`}
            >
              <span className="text-3xl" aria-hidden>
                {LEVEL_BY_ID[x.level].emoji}
              </span>
              <span>
                <span className="block font-extrabold text-ink">{t(`act.demo.${x.key}`)}</span>
                <span className="block text-xs font-bold text-muted">
                  {x.arch} · {t(`act.arch.${x.arch}`)}
                </span>
              </span>
            </button>
          ))}
        </nav>

        <div className="relative">
          <PlayContext.Provider value={ctx}>
            {finished ? (
              <section className="flex min-h-[480px] flex-col items-center justify-center gap-4 rounded-fk-lg border border-line bg-surface p-8 text-center shadow-soft">
                <Mascot mood="celebrate" size={200} />
                <h2 className="text-3xl font-extrabold text-ink">{t("act.demo.finished")}</h2>
                <p className="max-w-md text-ink-2">{t("act.demo.finished_sub")}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button type="button" onClick={() => choose((game + 1) % GAMES.length)} className="h-14 rounded-full bg-sky-soft px-8 text-lg font-extrabold text-ink hover:bg-[#d6e6f8]">
                    {t("act.demo.again")}
                  </button>
                  <LinkButton href="/signup" size="lg">
                    {t("nav.signup")}
                  </LinkButton>
                </div>
              </section>
            ) : (
              <Engine
                key={`${game}-${run}-${lang}`}
                activity={activity}
                onDone={() => {
                  sfx("chime");
                  setFinished(true);
                  setMood((x) => ({ m: "celebrate", n: x.n + 1 }));
                }}
              />
            )}
          </PlayContext.Provider>
          {!finished && (
            <div className="pointer-events-none absolute -bottom-4 -left-2 hidden md:block">
              <Mascot mood={mood.m} size={120} />
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-ink-2">
          <Chip tone="teal">✦</Chip>
          {t("act.demo.adapts")}
        </div>
      </main>
    </div>
  );
}
