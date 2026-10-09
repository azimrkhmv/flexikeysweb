"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Chip, Empty, LinkButton, useAction } from "@/components/ui";
import { api, sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import type { Child, Roadmap } from "@/lib/types";

// The 4-week roadmap, read-only (Today with one-tap Done is build #5). No scores, no percentages (spec rule 1).

const iso = () => new Date().toISOString().slice(0, 10);

export function PlanTab({ child }: { child: Child }) {
  const t = useT();
  const db = useDb();
  const router = useRouter();
  const plan = sel.roadmap(db, child.id);
  const round = sel.intakeRound(db, child.id);
  const reintake = useAction(api.startReintake);

  if (!plan)
    return (
      <Empty>
        <p>{round && !round.completedAt ? t("intake.unfinished", { name: child.name }) : t("plan.none")}</p>
        <LinkButton href={`/parent/children/new?child=${child.id}`} className="mt-4">
          {round ? t("intake.continue") : t("plan.start")}
        </LinkButton>
      </Empty>
    );

  return (
    <div className="space-y-6">
      <Why plan={plan} />
      <Weeks plan={plan} />
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm text-ink-2">{t("plan.reintake.d")}</p>
        <Button
          variant="outline"
          pending={reintake.pending}
          onClick={async () => {
            if ((await reintake.run(child.id)) !== undefined) router.push(`/parent/children/new?child=${child.id}`);
          }}
        >
          {t("plan.reintake")}
        </Button>
      </Card>
    </div>
  );
}

/** Two or three plain sentences from the rules' structured reasons (the AI rewrite comes with the assistant). */
function Why({ plan }: { plan: Roadmap }) {
  const t = useT();
  const goals = [...new Set(plan.reasons.map((r) => r.goal))];
  const minutes = plan.days[0] ? plan.days[0].games.reduce((s, g) => s + g.minutes, 0) * 2 : 10;
  return (
    <Card className="space-y-2 p-5">
      <h2 className="text-lg font-extrabold text-ink">{t("plan.why")}</h2>
      <p className="text-ink-2">{t("plan.why.goals", { goals: goals.map((g) => t(`intake.P33.${g}`).toLowerCase()).join(", ") })}</p>
      {plan.exercisesAllowed ? (
        <>
          <p className="text-ink-2">{t("plan.why.safe")}</p>
          <p className="text-ink-2">{t("plan.why.time", { min: minutes })}</p>
        </>
      ) : (
        <p className="text-ink-2">{t("plan.why.gamesOnly")}</p>
      )}
    </Card>
  );
}

function Weeks({ plan }: { plan: Roadmap }) {
  const t = useT();
  const db = useDb();
  const [lang] = useLang();
  const today = iso();
  const current = Math.max(0, Math.min(3, Math.floor(plan.days.findIndex((d) => d.date === today) / 7)));
  const [week, setWeek] = useState(current);
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(lang === "uz" ? "uz-Latn" : lang, { weekday: "short", day: "numeric", month: "short" });
  return (
    <section>
      <div role="group" aria-label={t("plan.tab")} className="mb-4 flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
        {[0, 1, 2, 3].map((w) => (
          <button
            key={w}
            type="button"
            aria-pressed={week === w}
            onClick={() => setWeek(w)}
            className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold ${week === w ? "bg-surface text-primary shadow-soft" : "text-ink-2"}`}
          >
            {t("plan.week", { n: w + 1 })}
          </button>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {plan.days.slice(week * 7, week * 7 + 7).map((d) => (
          <Card as="li" key={d.date} className={`space-y-3 p-4 ${d.date === today ? "ring-2 ring-teal" : ""}`}>
            <p className="flex items-center gap-2 font-extrabold text-ink">
              {fmt(d.date)} {d.date === today && <Chip tone="teal">{t("plan.today")}</Chip>}
            </p>
            {d.exercises.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase text-muted">{t("plan.exercises")}</p>
                <ul className="mt-1 space-y-1">
                  {d.exercises.map((e) => {
                    const v = sel.video(db, e.videoId);
                    return (
                      <li key={e.videoId} className="text-sm text-ink">
                        {v?.title[lang] ?? e.videoId}
                        {v?.tool && <span className="block text-xs text-muted">{t("plan.tool", { tool: t(`tool.${v.tool}`) })}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase text-muted">{t("plan.games")}</p>
              <ul className="mt-1 space-y-1">
                {d.games.map((g, k) => (
                  <li key={k} className="text-sm text-ink">
                    {t(`game.${g.kind}`)} · <span className="text-muted">{t("plan.minutes", { n: g.minutes })}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </ul>
    </section>
  );
}
