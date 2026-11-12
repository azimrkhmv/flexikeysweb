"use client";

import { Card } from "@/components/ui";
import { SKILL_GAMES } from "@/content/skillGames";
import { sel, useDb } from "@/lib/api";
import { useLang, useT, type Lang } from "@/lib/i18n";
import type { AreaProgress, StepRef } from "@/lib/skill";
import { ProLock } from "./ProLock";

// The progress panel (games spec 8 Nov 2026 §8, B89): a card per skill area with its level 1–100, a plain line of the
// last 8 weeks and what the child can do now and 4 weeks ago. No percentage and no comparison with other children,
// age groups or averages anywhere (product rule 1). Parents see it in the Progress tab; a therapist the same cards with
// the tries, access events and open tier of each area.

/** The "can do" sentence of a skill-game step, starting small so it reads on after "Now:". */
export function canDoText(ref: StepRef | null, lang: Lang): string | null {
  if (!ref) return null;
  const text = SKILL_GAMES.find((g) => g.id === ref.activityId)?.steps.find((s) => s.tier === ref.tier && s.step === ref.step)?.can_do?.[lang];
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : null;
}

const W = 168;
const H = 44;

/** The last 8 weeks as a plain line (no chart package, no axis numbers). A week with no level is a gap. */
function WeekLine({ weeks, label }: { weeks: AreaProgress["weeks"]; label: string }) {
  const x = (k: number) => 6 + (k * (W - 12)) / (weeks.length - 1);
  const y = (level: number) => H - 6 - ((level - 1) / 99) * (H - 12);
  const runs: string[] = [];
  let run: string[] = [];
  weeks.forEach((w, k) => {
    if (w.level === null) {
      if (run.length > 1) runs.push(run.join(" "));
      run = [];
    } else run.push(`${x(k)},${y(w.level)}`);
  });
  if (run.length > 1) runs.push(run.join(" "));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-11 w-full max-w-56" role="img" aria-label={label}>
      <line x1={6} x2={W - 6} y1={H - 3} y2={H - 3} stroke="var(--fk-line)" strokeWidth={1} />
      {runs.map((points) => (
        <polyline key={points} points={points} fill="none" stroke="var(--fk-teal)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {weeks.map((w, k) => (w.level === null ? null : <circle key={w.weekStart} cx={x(k)} cy={y(w.level)} r={k === weeks.length - 1 ? 3.5 : 2.5} fill="var(--fk-teal)" />))}
    </svg>
  );
}

export function SkillCards({ childId, therapist = false }: { childId: string; therapist?: boolean }) {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const areas = sel.skillProgress(db, childId, therapist);
  // Tiers above Seed need Pro (B83): the child sees a sleeping cloud; the parent sees why here.
  const showLock = !therapist && !sel.isPro(db, childId);

  return (
    <section className="space-y-3" aria-labelledby="skill-levels">
      <div>
        <h2 id="skill-levels" className="text-lg font-extrabold">
          {t("progress.title")}
        </h2>
        <p className="text-sm text-muted">{t(therapist ? "progress.noteTherapist" : "progress.note")}</p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {areas.map((a) => {
          const now = canDoText(a.now, lang);
          const before = canDoText(a.before, lang);
          const weeks = a.weeks.map((w) => (w.level === null ? t("progress.noWeek") : String(w.level))).join(", ");
          return (
            <li key={a.area}>
              <Card className="flex h-full flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold">{t(`skill.area.${a.area}`)}</h3>
                  {a.level === null ? (
                    <span className="text-right text-sm font-semibold text-muted">{t("progress.notEnough")}</span>
                  ) : (
                    <span className="text-right">
                      <span className="sr-only">{t("progress.level")} </span>
                      <span className="text-4xl font-extrabold leading-none text-ink">{a.level}</span>
                    </span>
                  )}
                </div>
                <WeekLine weeks={a.weeks} label={t("progress.weeks", { list: weeks })} />
                {now && a.level !== null && <p className="text-sm text-ink-2">{before && before !== now ? t("progress.nowBefore", { now, before }) : t("progress.now", { now })}</p>}
                {therapist && (
                  <dl className="mt-1 grid grid-cols-1 gap-0.5 text-xs text-muted">
                    <div>
                      <dt className="inline">{t("progress.tries")}: </dt>
                      <dd className="inline font-semibold text-ink-2">{a.tries ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="inline">{t("progress.access")}: </dt>
                      <dd className="inline font-semibold text-ink-2">{t("progress.ofTries", { n: a.accessEvents ?? 0, total: a.tries ?? 0 })}</dd>
                    </div>
                    <div>
                      <dt className="inline">{t("progress.tier")}: </dt>
                      <dd className="inline font-semibold text-ink-2">{t(`skill.tier.${a.topTier}`)}</dd>
                    </div>
                  </dl>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
      {showLock && <ProLock text={t("progress.lock")} />}
    </section>
  );
}
