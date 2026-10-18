"use client";

import { Gamepad2, Play, Video } from "lucide-react";
import { Avatar, Card, Chip, LinkButton } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import type { Child, ExerciseVideo } from "@/lib/types";

// Today (spec §10): the first thing a parent sees. Each child's exercises for today, with the video and the Home Kit
// tool, and today's games. Done, pause and the week view come next (B8, B9). No scores, no percentages (rule 1).

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
  const day = plan.days.find((d) => d.date === today);
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
                  return v && <ExerciseItem key={e.videoId} video={v} />;
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

function ExerciseItem({ video }: { video: ExerciseVideo }) {
  const t = useT();
  const [lang] = useLang();
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
      </div>
    </li>
  );
}
