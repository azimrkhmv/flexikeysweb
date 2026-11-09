"use client";

import "@/messages/child";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LangSwitch, Logo } from "@/components/brand";
import { Mascot } from "@/components/Mascot";
import { SKILL_GAMES } from "@/content/skillGames";
import { PlayMotion } from "@/features/activities/anim";
import { SkillPlay } from "@/features/activities/skill";
import { DEMO_PLAY, PlayContext, type PlayCtx } from "@/features/play/context";
import { SCAN_DEFAULT, useScanning } from "@/features/play/Target";
import { sel, useDb } from "@/lib/api";
import { LIVE } from "@/lib/api/mode";
import { sfx, unlockAudio } from "@/lib/audio";
import { daySeed } from "@/lib/games/rng";
import { useLang, useT } from "@/lib/i18n";
import type { AccessMode } from "@/lib/types";

// Games spec 8 Nov 2026, §9: every skill game and every one of its 12 steps, playable straight away — no tiers, no
// weekly rule, no Free / Pro, and nothing is saved to any child. Bekzod uses it to try all games. Mock mode (the
// Vercel demo) lets anyone in; the live app only admins. `?game=<kind>&step=<1–12>` opens a step, `?access=dwell|scan`
// plays with hold-to-choose or switch scanning (Space moves, Enter chooses), as on /demo.

const DEMO_DWELL_MS = 600;
const noSubscribe = () => () => {};

function useOptions() {
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  const q = new URLSearchParams(search);
  const access = q.get("access");
  const game = Math.max(0, SKILL_GAMES.findIndex((g) => g.kind === q.get("game")));
  const step = Math.min(11, Math.max(0, Number(q.get("step") ?? 1) - 1 || 0));
  return { access: (access === "dwell" || access === "scan" ? access : "touch") as AccessMode, game, step };
}

export default function SkillGamesDemo() {
  const db = useDb();
  const t = useT();
  if (LIVE && sel.me(db)?.role !== "admin")
    return (
      <div className="grid min-h-dvh place-items-center bg-bg p-6 text-center">
        <p className="max-w-md text-lg font-bold text-ink-2">{t("skill.demo.admins")}</p>
      </div>
    );
  return <Player />;
}

function Player() {
  const [lang] = useLang();
  const t = useT();
  const options = useOptions();
  const [pick, setPick] = useState<{ game: number; step: number } | null>(null);
  const game = SKILL_GAMES[pick?.game ?? options.game];
  const stepIndex = pick?.step ?? options.step;
  const step = game.steps[stepIndex];
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useScanning(options.access === "scan", root, { ...SCAN_DEFAULT, mode: "step", lang });

  const ctx: PlayCtx = useMemo(
    () => ({
      ...DEMO_PLAY,
      access: options.access,
      profile: options.access === "dwell" ? { ...DEMO_PLAY.profile, dwellMs: DEMO_DWELL_MS } : DEMO_PLAY.profile,
      learnLang: lang,
      uiLang: lang,
      levelId: "skill",
      emit: (e) => (window.fkInput ??= { accepts: [], events: [] }).events.push(e.type),
      onAccept: (how) => (window.fkInput ??= { accepts: [], events: [] }).accepts.push(how),
    }),
    [lang, options.access],
  );

  const go = (g: number, s: number) => {
    setPick({ game: g, step: s });
    setFinished(false);
    setRun((r) => r + 1);
  };
  const tierStep = (k: number) => `${t(`skill.tier.${game.steps[k].tier}`)} · ${game.steps[k].step}`;
  const gi = SKILL_GAMES.indexOf(game);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg" onPointerDownCapture={unlockAudio}>
      {/* One row on a phone too, so the game keeps the room (it must fit without scrolling). */}
      <header className="flex items-center gap-2 px-3 py-2">
        <span className="hidden sm:block">
          <Logo />
        </span>
        <h1 className="sr-only">{t("skill.demo.title")}</h1>
        <label className="flex min-w-0 items-center gap-1 text-sm font-bold text-ink-2 sm:ml-auto">
          <span className="hidden sm:inline">{t("skill.demo.games")}</span>
          <select className="h-11 min-w-0 max-w-[44vw] rounded-fk border border-line bg-surface px-2 text-sm font-bold text-ink sm:max-w-none sm:text-base" value={gi} onChange={(e) => go(Number(e.target.value), 0)}>
            {SKILL_GAMES.map((g, k) => (
              <option key={g.id} value={k}>
                {t(`skill.game.${g.kind}`)} · {t(`skill.area.${g.area}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 items-center gap-1 text-sm font-bold text-ink-2">
          <span className="hidden sm:inline">{t("skill.demo.steps")}</span>
          <select className="h-11 min-w-0 rounded-fk border border-line bg-surface px-2 text-sm font-bold text-ink sm:text-base" value={stepIndex} onChange={(e) => go(gi, Number(e.target.value))}>
            {game.steps.map((s, k) => (
              <option key={k} value={k}>
                {tierStep(k)}
              </option>
            ))}
          </select>
        </label>
        <LangSwitch compact />
      </header>
      <p className="px-3 pb-1 text-center text-xs font-bold text-muted" title={t("skill.demo.subtitle")}>
        {step.can_do?.[lang]}
      </p>
      <main ref={root} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3 sm:px-6">
        <PlayContext.Provider value={ctx}>
          <PlayMotion>
            {finished ? (
              <section className="flex h-full flex-col items-center justify-center gap-4 rounded-fk-lg border border-line bg-surface p-8 text-center shadow-soft">
                <Mascot mood="celebrate" size={160} />
                <h2 className="text-3xl font-extrabold text-ink">{t("skill.demo.finished")}</h2>
                <div className="flex flex-wrap justify-center gap-3">
                  <button type="button" onClick={() => go(gi, stepIndex)} className="h-14 rounded-full bg-sky-soft px-8 text-lg font-extrabold text-ink hover:bg-[#d6e6f8]">
                    {t("skill.demo.again")}
                  </button>
                  {stepIndex < 11 && (
                    <button type="button" onClick={() => go(gi, stepIndex + 1)} className="h-14 rounded-full bg-teal px-8 text-lg font-extrabold text-white">
                      {t("skill.demo.next")} · {tierStep(stepIndex + 1)}
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <SkillPlay
                key={`${game.id}-${stepIndex}-${run}-${lang}`}
                game={game}
                step={step}
                // A new set of rounds every time a step is played again.
                seed={daySeed("demo", String(run), game.id)}
                onDone={() => {
                  sfx("chime");
                  setFinished(true);
                }}
              />
            )}
          </PlayMotion>
        </PlayContext.Provider>
      </main>
    </div>
  );
}
