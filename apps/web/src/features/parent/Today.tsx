"use client";

import { Check, Gamepad2, Play, Video } from "lucide-react";
import { Avatar, Button, Card, Chip, LinkButton, useAction } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { api, sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import type { Child, ExerciseVideo, Feeling } from "@/lib/types";

// Today (spec §10): the first thing a parent sees. Each child's exercises for today, with the video and the Home Kit
// tool, and today's games. One tap marks an exercise done, then an optional easy / OK / hard (spec §8). Pause and
// the week view come next (B9). No scores, no percentages (rule 1).

/** Today's date on this device, YYYY-MM-DD. */
const localIso = () => new Date().toLocaleDateString("en-CA");

export function Today({ kids }: { kids: Child[] }) {
  const t = useT();
  const db = useDb();
  const withPlan = kids.flatMap((child) => {
    const plan = sel.roadmap(db, child.id);
    return plan ? [{ child, plan }] : [];
  });
  if (withPlan.length === 0) return null;
  return (
    <section aria-labelledby="today-title" className="mb-6 space-y-4">
      <h2 id="today-title" className="text-lg font-extrabold text-ink">
        {t("plan.today")}
      </h2>
      {withPlan.map(({ child, plan }) => (
        <ChildToday key={child.id} child={child} plan={plan} />
      ))}
    </section>
  );
}

function ChildToday({ child, plan }: { child: Child; plan: NonNullable<ReturnType<typeof sel.roadmap>> }) {
  const t = useT();
  const db = useDb();
  const [lang] = useLang();
  const today = localIso();
  const dayIndex = plan.days.findIndex((d) => d.date === today);
  const day = plan.days[dayIndex];
  return (
    <Card as="article" className="space-y-4">
      <h3 className="flex items-center gap-3 text-xl font-extrabold">
        <Avatar emoji={child.avatar} size={40} tone="lavender" /> {child.name}
      </h3>
      {!day ? (
        <p className="text-ink-2">
          {today < plan.startDate ? t("today.notYet", { date: fmtDate(plan.startDate, lang) }) : t("today.finished")}
        </p>
      ) : (
        <>
          {day.exercises.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-muted">{t("plan.exercises")}</p>
              <ul className="grid gap-3 md:grid-cols-2">
                {day.exercises.map((e) => {
                  const v = sel.video(db, e.videoId);
                  return v && <ExerciseItem key={e.videoId} child={child} day={dayIndex} video={v} />;
                })}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-muted">{t("plan.games")}</p>
            <ul className="flex flex-wrap gap-2">
              {day.games.map((g, k) => (
                <li key={k}>
                  <Chip tone="leaf">
                    <Gamepad2 className="size-3.5" aria-hidden /> {t(`game.${g.kind}`)} · {t("plan.minutes", { n: g.minutes })}
                  </Chip>
                </li>
              ))}
            </ul>
            <LinkButton href="/play" size="md" className="mt-3">
              <Play className="size-4" aria-hidden /> {t("parent.home.play")}
            </LinkButton>
          </div>
        </>
      )}
    </Card>
  );
}

const FEELINGS: Feeling[] = ["easy", "ok", "hard"];

function ExerciseItem({ child, day, video }: { child: Child; day: number; video: ExerciseVideo }) {
  const t = useT();
  const db = useDb();
  const [lang] = useLang();
  const done = sel.tasksDone(db, child.id).find((d) => d.day === day && d.videoId === video.id);
  const markDone = useAction(api.markDone);
  const rate = useAction(api.rateDone);
  const planned = sel.roadmap(db, child.id)?.days[day]?.exercises.find((e) => e.videoId === video.id)?.level ?? 1;
  const level = sel.exerciseLevel(db, child.id, video.id);
  // Only a physio-approved version is ever shown (rule 3); the plan only holds exercises with one.
  const file = video.versions[lang]?.status === "approved" ? video.versions[lang] : undefined;
  return (
    <li className="overflow-hidden rounded-2xl border border-line">
      {file?.url ? (
        <video controls preload="metadata" src={file.url} className="aspect-video w-full bg-ink" aria-label={video.title[lang]} />
      ) : (
        <div className="grid aspect-video place-items-center bg-surface-2 text-sm font-bold text-muted">
          <span className="flex items-center gap-2">
            <Video className="size-5" aria-hidden /> {t("today.videoSoon")}
          </span>
        </div>
      )}
      <div className="space-y-1 p-3">
        <p className="font-extrabold text-ink">{video.title[lang]}</p>
        {video.tool && <p className="text-sm text-muted">{t("plan.tool", { tool: t(`tool.${video.tool}`) })}</p>}
        {!done ? (
          <Button className="mt-2" pending={markDone.pending} onClick={() => markDone.run(child.id, day, video.id)}>
            <Check className="size-4" aria-hidden /> {t("today.done")}
          </Button>
        ) : (
          <div className="space-y-2 pt-1">
            <Chip tone="leaf">
              <Check className="size-3.5" aria-hidden /> {t("today.isDone")}
            </Chip>
            <div role="group" aria-label={t("today.howWasIt")} className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-2">{t("today.howWasIt")}</span>
              {FEELINGS.map((f) => (
                <Button key={f} size="sm" variant={done.feeling === f ? "soft" : "outline"} aria-pressed={done.feeling === f} onClick={() => rate.run(child.id, done.id, f)}>
                  {t(`today.feeling.${f}`)}
                </Button>
              ))}
            </div>
            {level !== planned && <p className="text-sm text-ink-2">{t(level < planned ? "today.easierNext" : "today.harderNext")}</p>}
          </div>
        )}
        {(markDone.error ?? rate.error) && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{markDone.error ?? rate.error}</p>}
      </div>
    </li>
  );
}
