"use client";

import { useRouter } from "next/navigation";
import { Component, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { ArrowLeft, Maximize, Pause } from "lucide-react";
import { Mascot } from "@/components/Mascot";
import { LEVELS, LEVEL_BY_ID } from "@/content/levels";
import { SHOP_BY_ID } from "@/content/shop";
import { ENGINES, type EngineProps } from "@/features/activities/registry";
import { api, sel, useDb, type ChildAuth, type DB } from "@/lib/api";
import { sfx, speak, unlockAudio } from "@/lib/audio";
import { useT, type Lang } from "@/lib/i18n";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { AdaptiveProfile, Child, InputProfile, InteractionEvent, MascotMood } from "@/lib/types";
import { Aac } from "./Aac";
import { ParentGate } from "./ParentGate";
import { Shop } from "./Shop";
import { Target, useScanning, type SelectInfo } from "./Target";
import { LevelView, WorldMap } from "./WorldMap";
import { PlayContext, type PlayCtx, type PlayEvent } from "./context";

type View =
  | { v: "start" }
  | { v: "bye" }
  | { v: "map" }
  | { v: "aac" }
  | { v: "shop" }
  | { v: "level"; levelId: string }
  | { v: "activity"; levelId: string; activityId: string }
  | { v: "celebrate"; levelId: string; activityId: string; coins: number; stars: number; levelDone: boolean };

const DEFAULT_BG = "linear-gradient(180deg,#eaf3fc 0%,#f5f9f0 60%,#e3f0dc 100%)";
const FLUSH_EVERY = 10;
const FLUSH_MS = 5000;

const inputOf = (p: SelectInfo["pointerType"]): InputProfile => (p === "mouse" ? "pointer" : p === "keyboard" || p === "switch" ? "keyboard" : "touch");
const pick = (prefix: string, n: number) => `${prefix}.${1 + Math.floor(Math.random() * n)}`;

/** First incomplete activity of the first open level — so Start leads straight into a game (FR-PLAY-1). */
function nextUp(db: DB, childId: string) {
  for (let i = 0; i < LEVELS.length; i++) {
    if (sel.levelState(db, childId, i) !== "open") continue;
    const l = LEVELS[i];
    const done = sel.levelProgress(db, childId, l.id).completed;
    return { levelId: l.id, activityId: (l.activities.find((a) => !done.includes(a.id)) ?? l.activities[0]).id };
  }
  return null;
}

function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** Child errors never show text: mascot + one way back. Remounted per view via `key`. */
class ChildBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch(e: unknown) {
    console.error("[child-mode]", e);
  }
  render() {
    return this.state.broken ? this.props.fallback : this.props.children;
  }
}

export function ChildMode({ child, auth }: { child: Child; auth: ChildAuth }) {
  const db = useDb();
  const router = useRouter();
  const lang: Lang = child.uiLang;
  const t = useT(lang);
  const [view, setView] = useState<View>({ v: "start" });
  const [mood, setMood] = useState<MascotMood>("wave");
  const [overlay, setOverlay] = useState<null | "menu" | "gate" | "break">(null);
  const [breakDue, setBreakDue] = useState(false);
  const [input, setInput] = useState<InputProfile>("touch");
  const online = useOnline();
  const shellRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const session = useRef<{ id: string; start: number } | null>(null);
  /** True between Start and "finish for today" — a session should exist while this is set. */
  const playing = useRef(false);
  const inputRef = useRef<InputProfile>("touch");
  const startTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const buffer = useRef<Omit<InteractionEvent, "sessionId">[]>([]);
  const lastAccept = useRef<number | null>(null);
  const moodTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const breakStart = useRef(0);
  const here = useRef<{ levelId?: string; activityId?: string }>({});

  const levelId = "levelId" in view ? view.levelId : undefined;
  const activityId = view.v === "activity" ? view.activityId : undefined;
  useEffect(() => {
    here.current = { levelId, activityId };
  }, [levelId, activityId]);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  // Profile re-parsed only when its values change, so engines don't re-run effects on every DB write.
  const profileKey = JSON.stringify(sel.profile(db, child.id, input));
  const profile = useMemo(() => JSON.parse(profileKey) as AdaptiveProfile, [profileKey]);

  // ---------- telemetry (batched: every 10 events, every 5 s, and when the page hides)
  const flush = useCallback((force = false) => {
    const s = session.current;
    if (!s || !buffer.current.length || (!force && !navigator.onLine)) return;
    const batch = buffer.current.splice(0);
    api.postEvents(s.id, batch).catch(() => {});
  }, []);

  const endSession = useCallback(() => {
    flush(true);
    const s = session.current;
    session.current = null;
    if (s) api.endSession(s.id).catch(() => {});
  }, [flush]);

  /** `pagehide` ends the session, but a page restored from the back/forward cache keeps playing — start a new one. */
  const ensureSession = useCallback(async () => {
    if (!session.current && playing.current) {
      const id = await api.startSession(inputRef.current).catch(() => null);
      if (id && !session.current) session.current = { id, start: performance.now() };
    }
    return session.current;
  }, []);

  const emit = useCallback(
    (e: PlayEvent) => {
      const s = session.current;
      if (!s) return;
      buffer.current.push({ ...here.current, ...e, t: Math.round(performance.now() - s.start) });
      if (buffer.current.length >= FLUSH_EVERY) flush();
    },
    [flush],
  );

  useEffect(() => {
    const tick = setInterval(() => flush(), FLUSH_MS);
    const breakCheck = setInterval(() => {
      if (session.current && Date.now() - breakStart.current >= profile.breakAfterMin * 60_000) setBreakDue(true);
    }, 20_000);
    return () => {
      clearInterval(tick);
      clearInterval(breakCheck);
    };
  }, [flush, profile.breakAfterMin]);

  useEffect(() => {
    const onVis = () => document.visibilityState === "hidden" && flush(true);
    const onShow = (e: PageTransitionEvent) => e.persisted && void ensureSession();
    const onPtr = (e: PointerEvent) => setInput(inputOf(e.pointerType as SelectInfo["pointerType"]));
    const onKey = (e: KeyboardEvent) => (e.key.length === 1 || e.key === "Enter") && setInput("keyboard");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", endSession);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("pointerdown", onPtr, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", endSession);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("pointerdown", onPtr, true);
      window.removeEventListener("keydown", onKey, true);
      clearTimeout(startTimer.current);
      clearTimeout(moodTimer.current);
      endSession();
    };
  }, [flush, endSession, ensureSession]);

  // ---------- mascot + voice
  const setMoodFor = useCallback((m: MascotMood, ms = 2200) => {
    setMood(m);
    clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood("calm"), ms);
  }, []);
  const say = useCallback((text: string, l: Lang = lang) => speak(text, l), [lang]);
  const react = useCallback(
    (kind: "success" | "try") => {
      if (kind === "success") {
        sfx("success");
        setMoodFor("happy");
        speak(t(pick("play.praise", 6)), lang);
      } else {
        sfx("soft");
        setMoodFor("curious");
        speak(t(pick("play.try", 4)), lang);
      }
    },
    [lang, t, setMoodFor],
  );

  const ctx: PlayCtx = useMemo(
    () => ({ childName: child.name, profile, access: child.access, learnLang: child.learningLang, uiLang: lang, levelId, activityId, emit, react, say, lastAccept }),
    [child.name, profile, child.access, child.learningLang, lang, levelId, activityId, emit, react, say],
  );

  // ---------- navigation
  const [starting, setStarting] = useState(false);
  const begin = async (info: SelectInfo) => {
    if (starting) return;
    setStarting(true);
    unlockAudio(); // first gesture unlocks audio on every browser (FR-PLAY-4)
    const inp = inputOf(info.pointerType);
    setInput(inp);
    inputRef.current = inp;
    setMood("happy");
    speak(t("play.hello", { name: child.name }), lang);
    playing.current = true;
    await ensureSession();
    breakStart.current = Date.now();
    setBreakDue(false);
    const next = nextUp(db, child.id);
    // Let the greeting finish, then go straight into the next game.
    startTimer.current = setTimeout(() => {
      setStarting(false);
      setMood("calm");
      setView(next ? { v: "activity", ...next } : { v: "map" });
    }, 1600);
  };

  const openLevel = (id: string, force = false) => {
    const state = sel.levelState(db, child.id, LEVEL_BY_ID[id].n - 1);
    if (!force && (state === "sleeping" || state === "plan")) {
      setMoodFor("sleepy");
      speak(t("play.map.sleeping"), lang);
      return;
    }
    speak(LEVEL_BY_ID[id].title[lang], lang);
    setView({ v: "level", levelId: id });
  };

  const finishActivity = async (lvl: string, act: string) => {
    flush(true);
    sfx("chime");
    setMood("celebrate");
    const s = await ensureSession();
    const r = s ? await api.completeActivity(s.id, lvl, act).catch(() => null) : null;
    const reward = r ?? { coins: 0, stars: 0, levelDone: false };
    setView({ v: "celebrate", levelId: lvl, activityId: act, coins: reward.coins, stars: reward.stars, levelDone: reward.levelDone });
    speak(t(reward.levelDone ? "play.levelDone" : "play.celebrate"), lang);
  };

  const goNext = (lvl: string, act: string) => {
    setMood("calm");
    const level = LEVEL_BY_ID[lvl];
    const i = level.activities.findIndex((a) => a.id === act);
    if (i + 1 < level.activities.length) return setView({ v: "activity", levelId: lvl, activityId: level.activities[i + 1].id });
    const nextLevel = LEVELS[level.n];
    if (nextLevel && ["open", "done"].includes(sel.levelState(db, child.id, level.n))) return setView({ v: "level", levelId: nextLevel.id });
    setView({ v: "map" });
  };

  const back = () => {
    if (view.v === "activity") setView({ v: "level", levelId: view.levelId });
    else setView({ v: "map" });
  };

  const finishForToday = () => {
    playing.current = false;
    endSession();
    setOverlay(null);
    setBreakDue(false);
    setMood("sleepy");
    speak(t("play.bye"), lang);
    setView({ v: "bye" });
  };

  const exit = async () => {
    playing.current = false;
    endSession();
    await api.exitChildMode();
    router.replace(auth.grantedBy === "class" ? "/class" : "/parent");
  };

  const showBreak = overlay === "break" || (breakDue && !overlay && !["activity", "start", "bye"].includes(view.v));
  // Switch scanning covers the whole shell (nav included), or only the open overlay.
  useScanning(child.access === "scan" && overlay !== "gate", overlay === "menu" || showBreak ? overlayRef : shellRef);
  useFocusTrap(overlayRef, overlay === "menu" ? "menu" : showBreak ? "break" : null);
  useEffect(() => {
    if (showBreak) speak(`${t("play.break.title")}. ${t("play.break.body")}`, lang);
  }, [showBreak, t, lang]);
  useEffect(() => {
    if (!online) speak(t("play.offline"), lang);
  }, [online, t, lang]);

  const hat = SHOP_BY_ID[child.equipped.hat ?? ""]?.emoji;
  const tint = SHOP_BY_ID[child.equipped.color ?? ""]?.value;
  const withNav = ["map", "aac", "shop", "level"].includes(view.v);
  const bigBtn = "rounded-full px-8 text-xl font-extrabold shadow-soft";

  let body: ReactNode;
  switch (view.v) {
    case "start":
    case "bye":
      body = (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <Mascot mood={view.v === "bye" ? "sleepy" : starting ? "happy" : "wave"} size={230} hat={hat} tint={tint} />
          <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{view.v === "bye" ? t("play.bye") : t("play.hello", { name: child.name })}</h1>
          <Target label={view.v === "bye" ? t("play.again") : t("play.start")} onSelect={begin} disabled={starting} className={`${bigBtn} min-h-24 min-w-56 bg-teal text-3xl text-white`}>
            ▶ {view.v === "bye" ? t("play.again") : t("play.start")}
          </Target>
        </div>
      );
      break;
    case "map":
      body = <WorldMap child={child} onOpen={openLevel} />;
      break;
    case "level":
      body = <LevelView child={child} levelId={view.levelId} onPlay={(a) => setView({ v: "activity", levelId: view.levelId, activityId: a })} />;
      break;
    case "activity": {
      const a = LEVEL_BY_ID[view.levelId]?.activities.find((x) => x.id === view.activityId);
      const Engine = a ? (ENGINES[a.kind] as ComponentType<EngineProps>) : null;
      const { levelId: lvl, activityId: act } = view;
      body = (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col rounded-fk-lg border-4 border-white bg-surface/90 p-4 shadow-soft sm:p-6">
          {a && Engine ? <Engine key={a.id} activity={a} onDone={() => finishActivity(lvl, act)} /> : null}
        </div>
      );
      break;
    }
    case "celebrate": {
      const { levelId: lvl, activityId: act } = view;
      body = (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <Mascot mood="celebrate" size={230} hat={hat} tint={tint} />
          <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{t(view.levelDone ? "play.levelDone" : "play.celebrate")}</h1>
          <div className="flex gap-3 text-2xl font-extrabold text-ink">
            {view.stars > 0 && <span className="fk-pop rounded-full bg-sun-soft px-5 py-2">⭐ +{view.stars}</span>}
            {view.coins > 0 && <span className="fk-pop rounded-full bg-surface px-5 py-2">🪙 +{view.coins}</span>}
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Target label={t("play.nav.map")} onSelect={() => setView({ v: "map" })} className={`${bigBtn} bg-surface text-ink`}>
              🗺️ {t("play.nav.map")}
            </Target>
            <Target label={t("play.next")} onSelect={() => goNext(lvl, act)} className={`${bigBtn} bg-teal text-white`}>
              {t("play.next")} ▶
            </Target>
          </div>
        </div>
      );
      break;
    }
    case "aac":
      body = <Aac child={child} />;
      break;
    case "shop":
      body = <Shop child={child} />;
      break;
  }

  const fallback = (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <Mascot mood="calm" size={200} hat={hat} tint={tint} />
      <Target label={t("play.oops")} onSelect={() => setView({ v: "map" })} className={`${bigBtn} bg-teal text-white`}>
        🗺️ {t("play.oops")}
      </Target>
    </div>
  );

  return (
    <PlayContext.Provider value={ctx}>
      <div
        ref={shellRef}
        className="flex h-dvh flex-col overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] text-ink"
        style={{ background: SHOP_BY_ID[child.equipped.bg ?? ""]?.value ?? DEFAULT_BG }}
      >
        {/* top bar */}
        <header className="flex items-center gap-2 px-3 py-2">
          {!["start", "bye", "map", "celebrate"].includes(view.v) && (
            <Target label={t("play.back")} onSelect={back} className="grid place-items-center rounded-full bg-surface/90 text-ink shadow-soft">
              <ArrowLeft className="size-8" aria-hidden />
            </Target>
          )}
          <span className="ml-1 flex items-center gap-2 rounded-full bg-surface/80 px-3 py-1 text-lg font-extrabold">
            <span aria-hidden>{child.avatar}</span> {child.name}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Target
              label={t("play.fullscreen")}
              onSelect={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {})}
              className="grid place-items-center rounded-full bg-surface/70 text-ink-2"
            >
              <Maximize className="size-7" aria-hidden />
            </Target>
            <Target label={t("play.pause")} onSelect={() => setOverlay("menu")} className="grid place-items-center rounded-full bg-surface/90 text-ink shadow-soft">
              <Pause className="size-8" aria-hidden />
            </Target>
          </div>
        </header>

        {/* stage */}
        <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4 sm:px-6">
          <ChildBoundary key={view.v === "activity" ? view.activityId : view.v} fallback={fallback}>
            {body}
          </ChildBoundary>
        </main>

        {/* mascot companion */}
        {!["start", "bye", "celebrate", "shop"].includes(view.v) && (
          <div className="pointer-events-none fixed bottom-24 left-2 z-10 hidden sm:block" aria-hidden>
            <Mascot mood={mood} size={view.v === "activity" ? 96 : 120} hat={hat} tint={tint} />
          </div>
        )}

        {/* child nav */}
        {withNav && (
          <nav className="flex justify-center gap-3 border-t border-white/60 bg-surface/80 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
            {(
              [
                ["map", "🗺️", "play.nav.map"],
                ["aac", "💬", "play.nav.aac"],
                ["shop", "☁️", "play.nav.shop"],
              ] as const
            ).map(([v, icon, key]) => (
              <Target
                key={v}
                label={t(key)}
                selected={view.v === v || (v === "map" && view.v === "level")}
                onSelect={() => setView({ v })}
                className={`flex min-w-24 flex-col items-center justify-center rounded-3xl px-4 font-extrabold ${view.v === v || (v === "map" && view.v === "level") ? "bg-teal-soft text-ink" : "text-ink-2"}`}
              >
                <span className="text-3xl">{icon}</span>
                <span className="text-sm">{t(key)}</span>
              </Target>
            ))}
          </nav>
        )}
      </div>

      {/* overlays */}
      {overlay === "menu" && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#27406b]/30 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t("play.pause")}>
          <div ref={overlayRef} className="flex w-full max-w-sm flex-col gap-3 rounded-fk-lg bg-surface p-6 shadow-lift">
            <Target label={t("play.menu.continue")} onSelect={() => setOverlay(null)} className={`${bigBtn} bg-teal text-white`}>
              ▶ {t("play.menu.continue")}
            </Target>
            <Target label={t("play.menu.break")} onSelect={() => setOverlay("break")} className={`${bigBtn} bg-sky-soft text-ink`}>
              😴 {t("play.menu.break")}
            </Target>
            <Target label={t("play.menu.exit")} onSelect={() => setOverlay("gate")} className={`${bigBtn} bg-surface-2 text-ink-2`}>
              🔒 {t("play.menu.exit")}
            </Target>
          </div>
        </div>
      )}
      {overlay === "gate" && <ParentGate lang={lang} onPass={exit} onCancel={() => setOverlay(null)} />}
      {showBreak && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#dfe8f8]/85 p-4 backdrop-blur" role="dialog" aria-modal="true" aria-label={t("play.break.title")}>
          <div ref={overlayRef} className="flex flex-col items-center gap-5 text-center">
            <Mascot mood="sleepy" size={220} hat={hat} tint={tint} />
            <h2 className="text-3xl font-extrabold text-ink">{t("play.break.title")}</h2>
            <p className="text-xl text-ink-2">{t("play.break.body")}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Target
                label={t("play.menu.continue")}
                onSelect={() => {
                  breakStart.current = Date.now();
                  setBreakDue(false);
                  setOverlay(null);
                }}
                className={`${bigBtn} bg-teal text-white`}
              >
                ▶ {t("play.menu.continue")}
              </Target>
              <Target label={t("play.break.finish")} onSelect={finishForToday} className={`${bigBtn} bg-surface text-ink`}>
                🌙 {t("play.break.finish")}
              </Target>
            </div>
          </div>
        </div>
      )}
      {!online && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#eef2f8]/90 p-4 backdrop-blur" role="status">
          <div className="flex flex-col items-center gap-4 text-center">
            <Mascot mood="sleepy" size={200} hat={hat} tint={tint} />
            <h2 className="text-3xl font-extrabold text-ink">{t("play.offline")}</h2>
            <p className="text-lg text-ink-2">{t("play.offline.sub")}</p>
          </div>
        </div>
      )}
    </PlayContext.Provider>
  );
}
