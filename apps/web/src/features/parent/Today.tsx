"use client";

import { Check, Gamepad2, Pause, Play, Video } from "lucide-react";
import { Avatar, Button, Card, Chip, LinkButton, useAction } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { api, sel, useDb } from "@/lib/api";
import { localDate } from "@/lib/api/schema";
import { useLang, useT } from "@/lib/i18n";
import type { Child, ExerciseVideo, Feeling } from "@/lib/types";

// Today (spec §10): the first thing a parent sees. Each child's exercises for today, with the video and the Home Kit
// tool, and today's games. One tap marks an exercise done, then an optional easy / OK / hard (spec §8). A sick or
// very tired child: pause today, and the plan moves forward one day. The week view shows done, today and coming
// days; a day not done is never called "missed". No scores, no percentages (rule 1).

const DAY_MS = 86_400_000;
const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * DAY_MS).toISOString().slice(0, 10);

export function Today({ kids }: { kids: Child[] }) {
  const t = useT();
  const db = useDb();
  const withPlan = kids.filter((child) => sel.roadmap(db, child.id));
  if (withPlan.length === 0) return null;
  return (
    <section aria-labelledby="today-title" className="mb-6 space-y-4">
      <h2 id="today-title" className="text-lg font-extrabold text-ink">
        {t("plan.today")}
      </h2>
      {withPlan.map((child) => (
        <ChildToday key={child.id} child={child} />
      ))}
    </section>
  );
}

function ChildToday({ child }: { child: Child }) {
  const t = useT();
  const db = useDb();
  const [lang] = useLang();
  const plan = sel.roadmap(db, child.id)!;
  const today = localDate();
  const on = sel.planDayOn(db, child.id, today);
  const day = typeof on === "number" ? plan.days[on] : undefined;
  const pause = useAction(api.pauseToday);
  const resume = useAction(api.resumeToday);
  return (
    <Card as="article" className="space-y-4">
      <h3 className="flex items-center gap-3 text-xl font-extrabold">
        <Avatar emoji={child.avatar} size={40} tone="lavender" /> {child.name}
      </h3>
      {on === "paused" ? (
        <div className="space-y-3 rounded-2xl bg-sky-soft p-4">
          <p className="font-bold text-ink">{t("today.paused")}</p>
          <Button variant="outline" size="sm" pending={resume.pending} onClick={() => resume.run(child.id)}>
            {t("today.resume")}
          </Button>
        </div>
      ) : !day ? (
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
                  return v && <ExerciseItem key={e.videoId} child={child} day={on as number} video={v} />;
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
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <LinkButton href="/play" size="md">
                <Play className="size-4" aria-hidden /> {t("parent.home.play")}
              </LinkButton>
              <Button variant="ghost" pending={pause.pending} onClick={() => pause.run(child.id)}>
                <Pause className="size-4" aria-hidden /> {t("today.pause")}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted">{t("today.pause.d")}</p>
          </div>
        </>
      )}
      {(pause.error ?? resume.error) && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{pause.error ?? resume.error}</p>}
      <Week child={child} today={today} />
    </Card>
  );
}

/** Monday to Sunday of this week: done, paused, today and coming days. Past days not done get no label. */
function Week({ child, today }: { child: Child; today: string }) {
  const t = useT();
  const db = useDb();
  const [lang] = useLang();
  const monday = addDays(today, -((new Date(Date.parse(today)).getUTCDay() + 6) % 7));
  const done = new Set(sel.tasksDone(db, child.id).map((d) => d.day));
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(lang === "uz" ? "uz-Latn" : lang, { weekday: "short", day: "numeric" });
  return (
    <ol aria-label={t("today.week")} className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: 7 }, (_, k) => {
        const date = addDays(monday, k);
        const on = sel.planDayOn(db, child.id, date);
        const status =
          on === "paused" ? "paused" : on === null ? null : done.has(on) ? "done" : date === today ? "today" : date > today ? "coming" : null;
        return (
          <li
            key={date}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center text-xs ${date === today ? "border-teal ring-2 ring-teal" : "border-line"} ${status === "done" ? "bg-leaf-soft" : status === "paused" ? "bg-sky-soft" : ""}`}
          >
            <span className="font-bold text-ink">{fmt(date)}</span>
            <span className="text-muted">
              {status === "done" && <Check className="mx-auto size-4 text-ink" aria-hidden />}
              {status && t(`today.week.${status}`)}
            </span>
          </li>
        );
      })}
    </ol>
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
