"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Gamepad2, Play, Plus } from "lucide-react";
import { Avatar, Button, Card, Chip, LinkButton, PageHeader, useAction } from "@/components/ui";
import { SKILL_GAMES } from "@/content/skillGames";
import { planGames } from "@/features/parent/games";
import { ProLock } from "@/features/parent/ProLock";
import { AREA_ICON } from "@/features/play/SkillGames";
import { KIND_EMOJI } from "@/features/play/WorldMap";
import { api, sel, useDb } from "@/lib/api";
import { localDate } from "@/lib/api/schema";
import { useLang, useT } from "@/lib/i18n";
import { SHOWN_AREAS } from "@/lib/skill";
import type { Child, GameKind } from "@/lib/types";

// B96: a parent sees the games right away, before adding a child. "All games" is the whole catalogue of skill games,
// each one tried in the demo player (nothing is saved). "For your child" is the games of the child's plan. No scores
// and no percentages here (rule 1).

type Tab = "all" | "child";
/** A try opens the demo player; `from=parent` gives it the way back and the Seed steps (the tier Free includes). */
const tryHref = (kind: string) => `/demo/games?game=${kind}&from=parent`;

export default function ParentGames() {
  const t = useT();
  const db = useDb();
  const me = sel.me(db);
  // Page only renders after hydration (AppShell gate), so reading the hash here is safe.
  const [tab, setTab] = useState<Tab>(() => (typeof window !== "undefined" && window.location.hash === "#child" ? "child" : "all"));
  if (!me) return null;
  const pro = sel.familyPlan(db, sel.familyOf(db, me.id)).plan === "pro";
  const go = (next: Tab) => {
    setTab(next);
    history.replaceState(null, "", next === "child" ? "#child" : " ");
  };

  return (
    <>
      <PageHeader title={t("parent.games.title")} subtitle={t("parent.games.subtitle")} />
      <div role="group" aria-label={t("parent.games.title")} className="mb-6 flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
        {(["all", "child"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            onClick={() => go(k)}
            className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold transition ${tab === k ? "bg-surface text-primary shadow-soft" : "text-ink-2 hover:text-ink"}`}
          >
            {t(`parent.games.${k}`)}
          </button>
        ))}
      </div>
      {tab === "all" ? <AllGames pro={pro} /> : <ChildGames kids={sel.childrenOf(db, me.id)} />}
    </>
  );
}

function AllGames({ pro }: { pro: boolean }) {
  const t = useT();
  const [lang] = useLang();
  const areas = SHOWN_AREAS.filter((a) => SKILL_GAMES.some((g) => g.area === a));
  return (
    <div className="space-y-8">
      <p className="text-ink-2">{t("parent.games.allIntro", { n: SKILL_GAMES.length, areas: areas.length })}</p>
      {!pro && <ProLock text={t("parent.games.seedOnly")} />}
      {areas.map((area) => (
        <section key={area} aria-labelledby={`area-${area}`}>
          <h2 id={`area-${area}`} className="mb-1 flex items-center gap-2 text-lg font-extrabold text-ink">
            <span aria-hidden>{AREA_ICON[area]}</span> {t(`skill.area.${area}`)}
          </h2>
          {area === "speed" && <p className="mb-3 text-sm text-muted">{t("parent.games.speedNote")}</p>}
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {SKILL_GAMES.filter((g) => g.area === area).map((g) => {
              const name = t(`game.${g.kind}`);
              return (
                <Card as="li" key={g.id} className="flex flex-col gap-3 p-4">
                  <h3 className="flex items-center gap-3 font-extrabold text-ink">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl" aria-hidden>
                      {KIND_EMOJI[g.kind]}
                    </span>
                    {name}
                  </h3>
                  <p className="text-sm text-ink-2">
                    <span className="block">{t("parent.games.first", { can: g.steps[0].can_do?.[lang] ?? "" })}</span>
                    <span className="mt-1 block">{t("parent.games.last", { can: g.steps[g.steps.length - 1].can_do?.[lang] ?? "" })}</span>
                  </p>
                  <TryLink kind={g.kind} name={name} />
                </Card>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TryLink({ kind, name }: { kind: string; name: string }) {
  const t = useT();
  return (
    <LinkButton href={tryHref(kind)} variant="soft" size="sm" className="mt-auto self-start">
      <Play className="size-4" aria-hidden /> {t("parent.games.try")}
      <span className="sr-only">: {name}</span>
    </LinkButton>
  );
}

function ChildGames({ kids }: { kids: Child[] }) {
  const t = useT();
  const [picked, setPicked] = useState<string | null>(null);
  const child = kids.find((c) => c.id === picked) ?? kids[0];

  if (!child)
    return (
      <Card className="flex flex-col items-center gap-4 py-10 text-center">
        <Gamepad2 className="size-10 text-muted" aria-hidden />
        <p className="max-w-md text-ink-2">{t("parent.games.noChild")}</p>
        <LinkButton href="/parent/children/new">
          <Plus className="size-4" aria-hidden /> {t("parent.home.addChild")}
        </LinkButton>
      </Card>
    );

  return (
    <div className="space-y-4">
      {kids.length > 1 && (
        <div className="flex gap-2 overflow-x-auto" role="radiogroup" aria-label={t("parent.ai.child")}>
          {kids.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === child.id}
              onClick={() => setPicked(c.id)}
              className={`flex shrink-0 items-center gap-3 rounded-2xl p-3 text-left font-bold transition ${c.id === child.id ? "bg-surface shadow-soft ring-2 ring-teal" : "hover:bg-surface/70"}`}
            >
              <Avatar emoji={c.avatar} size={40} tone="lavender" /> {c.name}
            </button>
          ))}
        </div>
      )}
      <PlanGames key={child.id} child={child} />
    </div>
  );
}

function PlanGames({ child }: { child: Child }) {
  const t = useT();
  const db = useDb();
  const router = useRouter();
  const start = useAction(api.startChildMode);
  const plan = sel.roadmap(db, child.id);
  const round = sel.intakeRound(db, child.id);

  if (!plan)
    return (
      <Card className="flex flex-col items-center gap-4 py-10 text-center">
        <Gamepad2 className="size-10 text-muted" aria-hidden />
        <p className="max-w-md text-ink-2">{t("parent.games.noPlan", { name: child.name })}</p>
        <LinkButton href={`/parent/children/new?child=${child.id}`}>{round ? t("intake.continue") : t("plan.start")}</LinkButton>
      </Card>
    );

  const on = sel.planDayOn(db, child.id, localDate());
  const free = sel.freeDays(db, child.id); // Free: the first week (A7.2)
  const games = planGames(plan, typeof on === "number" ? on : null, free);
  return (
    <section aria-labelledby="plan-games" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="plan-games" className="text-lg font-extrabold text-ink">
            {t("parent.games.forChild", { name: child.name })}
          </h2>
          <p className="text-sm text-muted">{t("parent.games.forChildSub")}</p>
        </div>
        <Button
          pending={start.pending}
          onClick={async () => {
            if ((await start.run(child.id)) !== undefined) router.push("/play");
          }}
        >
          <Play className="size-4" aria-hidden /> {t("parent.games.playWith", { name: child.name })}
        </Button>
      </div>
      {start.error && (
        <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">
          {start.error}
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((g) => {
          const name = t(`game.${g.kind}`);
          return (
            <Card as="li" key={g.kind} className="flex flex-col gap-3 p-4">
              <h3 className="flex items-center gap-3 font-extrabold text-ink">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl" aria-hidden>
                  {KIND_EMOJI[g.kind as GameKind] ?? "🎮"}
                </span>
                {name}
              </h3>
              {g.today && (
                <Chip tone="leaf" className="self-start">
                  {t("parent.games.today", { n: g.minutes })}
                </Chip>
              )}
              {SKILL_GAMES.some((s) => s.kind === g.kind) && <TryLink kind={g.kind} name={name} />}
            </Card>
          );
        })}
      </ul>
      <p className="text-sm text-muted">{t("parent.games.playNote")}</p>
      {free !== null && <ProLock text={t("plans.lock.weeks")} />}
    </section>
  );
}
