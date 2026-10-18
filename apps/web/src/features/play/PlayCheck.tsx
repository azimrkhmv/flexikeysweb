"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Mascot } from "@/components/Mascot";
import { Button, Checkbox, useAction } from "@/components/ui";
import { api } from "@/lib/api";
import { sfx } from "@/lib/audio";
import { useT } from "@/lib/i18n";
import {
  HOLDS,
  holdTime,
  mmToPx,
  releaseOk,
  REPEAT_MS,
  repeatLock,
  SIZES_MM,
  sizeStep,
  struggles,
  TAPS,
  type AccessSettings,
  type InputMode,
  type Touch,
} from "@/lib/playcheck";
import type { Child } from "@/lib/types";

// Play check, stage 1 — hands and touch (spec §7, about 2 minutes). The child touches or holds one big ball; the
// screen only watches how. No timer, no red, no X, no failure sound (product rule 7): every touch gets a soft sound,
// every ball reached a happy one. The parent sits next to the child and may help; the app records that they did.

type Phase =
  | { p: "intro" }
  | { p: "taps"; mode: "touch" | "dwell"; touches: Touch[] }
  | { p: "sizes"; mode: "touch" | "dwell"; i: number; missed: number }
  | { p: "holds"; mode: "touch" | "dwell"; holds: number[]; extra: boolean[] }
  | { p: "done"; settings: AccessSettings };

/** Where the ball goes next (% of the play area): fixed, so every child gets the same check. */
const SPOTS = [
  [50, 50],
  [25, 35],
  [72, 62],
  [30, 68],
  [70, 32],
  [50, 25],
] as const;
const DWELL_TRY_MS = 1000; // the hold used while trying hold-to-choose
const BALL_MM = 40;

export function PlayCheck({ child }: { child: Child }) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>({ p: "intro" });
  const [n, setN] = useState(0); // which spot
  const all = useRef<Touch[]>([]); // every touch of the check, for accidental repeats
  const keys = useRef({ select: 0, other: 0 });
  const down = useRef<{ at: number; onBall: boolean; step: Phase["p"] } | null>(null);
  const lastUp = useRef(0);
  const [holding, setHolding] = useState(false);
  const sizes = useRef(BALL_MM); // the smallest ball that worked

  const finish = (inputMode: InputMode, extra: Partial<AccessSettings> = {}) =>
    setPhase({
      p: "done",
      settings: { inputMode, minTargetMm: BALL_MM, dwellMs: 1000, repeatLock: repeatLock(all.current), releaseOk: true, ...extra },
    });

  // A child who presses keys or a switch instead of touching: Space/Enter is a switch, other keys a keyboard.
  useEffect(() => {
    if (phase.p !== "taps") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === " " || e.key === "Enter") keys.current.select++;
      else keys.current.other++;
      if (keys.current.select + keys.current.other >= 3) {
        sfx("success");
        finish(keys.current.other > keys.current.select ? "keyboard" : "switch");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** One choice of the ball: a touch (touch mode) or a hold long enough (dwell mode). */
  const choose = (hit: boolean) => {
    sfx(hit ? "success" : "soft");
    if (hit) setN((x) => x + 1);
    if (phase.p === "taps") {
      const touches = [...phase.touches, { hit, at: performance.now() }];
      if (touches.length < TAPS) return setPhase({ ...phase, touches });
      if (!struggles(touches)) return setPhase({ p: "sizes", mode: phase.mode, i: 0, missed: 0 });
      if (phase.mode === "touch") return setPhase({ p: "taps", mode: "dwell", touches: [] }); // offer hold-to-choose
      return finish("switch"); // holding is hard too: switch scanning
    }
    if (phase.p === "sizes") {
      const next = sizeStep(phase, hit);
      if (next.done === undefined) return setPhase({ ...phase, ...next });
      setPhase({ p: "holds", mode: phase.mode, holds: [], extra: [] });
      sizes.current = next.done;
    }
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    const now = performance.now();
    const onBall = !!(e.target as HTMLElement).closest("[data-ball]");
    all.current.push({ hit: onBall, at: now });
    if (phase.p === "holds" && now - lastUp.current < REPEAT_MS && phase.extra.length) {
      // a touch right after letting go: the release was not clean
      return setPhase({ ...phase, extra: [...phase.extra.slice(0, -1), true] });
    }
    down.current = { at: now, onBall, step: phase.p };
    const holdMode = phase.p === "holds" || ((phase.p === "taps" || phase.p === "sizes") && phase.mode === "dwell");
    if (!holdMode) return choose(onBall);
    if (onBall) setHolding(true);
    else choose(false);
  };

  const onUp = () => {
    const d = down.current;
    down.current = null;
    setHolding(false);
    if (!d?.onBall || d.step !== phase.p) return; // a press that began in the step before belongs to it
    const now = performance.now();
    lastUp.current = now;
    const held = now - d.at;
    if (phase.p === "holds") {
      sfx("success");
      setN((x) => x + 1);
      const holds = [...phase.holds, held];
      const extra = [...phase.extra, false];
      if (holds.length < HOLDS) return setPhase({ ...phase, holds, extra });
      // wait a moment for a touch right after the last release before deciding
      setPhase({ ...phase, holds, extra });
      setTimeout(
        () =>
          setPhase((cur) => {
            const ex = cur.p === "holds" ? cur.extra : extra;
            return {
              p: "done",
              settings: {
                inputMode: phase.mode,
                minTargetMm: sizes.current,
                dwellMs: holdTime(holds),
                repeatLock: repeatLock(all.current),
                releaseOk: releaseOk(ex),
              },
            };
          }),
        REPEAT_MS + 50,
      );
      return;
    }
    // dwell mode: a hold long enough chooses; letting go early is a gentle "again". A touch already chose on the way down.
    if ((phase.p === "taps" || phase.p === "sizes") && phase.mode === "dwell") choose(held >= DWELL_TRY_MS);
  };

  if (phase.p === "intro")
    return (
      <Panel>
        <Mascot mood="wave" size={160} />
        <h1 className="text-2xl font-extrabold text-ink">{t("check.intro.title", { name: child.name })}</h1>
        <p className="max-w-md text-ink-2">{t("check.intro.text", { name: child.name })}</p>
        <Button size="lg" onClick={() => setPhase({ p: "taps", mode: "touch", touches: [] })}>
          {t("check.start")}
        </Button>
      </Panel>
    );

  if (phase.p === "done") return <Done child={child} settings={phase.settings} />;

  const mm = phase.p === "sizes" ? SIZES_MM[phase.i] : BALL_MM;
  const [x, y] = SPOTS[n % SPOTS.length];
  const hold = phase.p === "holds" || phase.mode === "dwell";
  return (
    <div className="flex min-h-dvh flex-col bg-[linear-gradient(180deg,#eaf3fc_0%,#f5f9f0_100%)]">
      <p className="p-6 text-center text-2xl font-extrabold text-ink" aria-live="polite">
        {t(phase.p === "holds" ? "check.holdLong" : hold ? "check.hold" : "check.touch")}
      </p>
      <div className="relative flex-1 touch-none select-none" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp} data-testid="check-area">
        <div
          data-ball=""
          role="img"
          aria-label={t("check.ball")}
          className="absolute grid place-items-center rounded-full bg-sky shadow-soft"
          style={{ left: `${x}%`, top: `${y}%`, width: mmToPx(mm), height: mmToPx(mm), transform: "translate(-50%, -50%)" }}
        >
          {hold && (
            <span
              aria-hidden
              className="block size-full rounded-full bg-leaf"
              style={{ transform: `scale(${holding ? 1 : 0})`, transition: holding ? `transform ${DWELL_TRY_MS}ms linear` : "none" }}
            />
          )}
        </div>
      </div>
      <Link href={`/parent/child/${child.id}`} className="p-4 text-center text-sm font-bold text-muted underline">
        {t("check.stop")}
      </Link>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[linear-gradient(180deg,#eaf3fc_0%,#f7f6f1_70%)] p-6 text-center">{children}</div>;
}

/** For the parent: what the check found, in plain words, never as a score. Saved with one tap. */
function Done({ child, settings }: { child: Child; settings: AccessSettings }) {
  const t = useT();
  const [helped, setHelped] = useState(false);
  const save = useAction(api.saveAccessSettings);
  const [saved, setSaved] = useState(false);
  return (
    <Panel>
      <Mascot mood="celebrate" size={160} />
      <h1 className="text-2xl font-extrabold text-ink">{t("check.done.title", { name: child.name })}</h1>
      <ul className="max-w-md space-y-1 text-left text-ink-2">
        <li>{t(`check.mode.${settings.inputMode}`)}</li>
        {(settings.inputMode === "touch" || settings.inputMode === "dwell") && <li>{t("check.size", { mm: settings.minTargetMm })}</li>}
        {settings.inputMode === "dwell" && <li>{t("check.dwell", { s: (settings.dwellMs / 1000).toFixed(1) })}</li>}
        {settings.repeatLock && <li>{t("check.repeat")}</li>}
        {!settings.releaseOk && <li>{t("check.release")}</li>}
      </ul>
      {saved ? (
        <Link href={`/parent/child/${child.id}`} className="font-extrabold text-primary underline">
          {t("check.back", { name: child.name })}
        </Link>
      ) : (
        <>
          <Checkbox checked={helped} onChange={setHelped} label={t("check.helped")} />
          <Button size="lg" pending={save.pending} onClick={async () => setSaved((await save.run(child.id, settings, helped)) !== undefined)}>
            {t("check.save")}
          </Button>
          {save.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{save.error}</p>}
        </>
      )}
    </Panel>
  );
}
