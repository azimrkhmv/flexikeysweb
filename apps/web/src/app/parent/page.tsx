"use client";

import Link from "next/link";
import { ChevronRight, Clock, Flame, MessageCircle, Play, Plus, School, Star, Stethoscope } from "lucide-react";
import { Mascot } from "@/components/Mascot";
import { Avatar, Card, Chip, LinkButton, Meter, PageHeader, Stat } from "@/components/ui";
import { LEVEL_BY_ID } from "@/content/levels";
import { age } from "@/features/parent/lib";
import { fmtDate } from "@/lib/format";
import { LockNote } from "@/features/pro/shared";
import { sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

export default function ParentHome() {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const me = sel.me(db);
  if (!me) return null;
  const kids = sel.childrenOf(db, me.id);
  const suggestions = kids.flatMap((c) => sel.assignmentsFor(db, c.id).map((a) => ({ a, child: c })));
  const sum = (f: (c: (typeof kids)[number]) => number) => kids.reduce((a, c) => a + f(c), 0);

  return (
    <>
      <PageHeader
        title={t("parent.home.title", { name: me.name })}
        subtitle={t("parent.home.subtitle")}
        actions={
          kids.length > 0 && (
            <>
              <LinkButton href="/parent/children/new" variant="soft">
                <Plus className="size-4" aria-hidden /> {t("parent.home.addChild")}
              </LinkButton>
              <LinkButton href="/play" size="md">
                <Play className="size-4" aria-hidden /> {t("parent.home.play")}
              </LinkButton>
            </>
          )
        }
      />

      {!me.emailVerified && (
        <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sun bg-sun-soft p-4 text-sm font-semibold text-[#7a5a0c]">
          {t("parent.home.verify")}
          <Link href="/verify-email" className="font-extrabold underline">
            {t("parent.home.verifyLink")}
          </Link>
        </div>
      )}

      {kids.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <Mascot mood="wave" size={150} />
          <h2 className="text-xl font-extrabold">{t("parent.home.emptyTitle")}</h2>
          <p className="max-w-md text-ink-2">{t("parent.home.emptyText")}</p>
          <LinkButton href="/parent/children/new" size="lg">
            <Plus className="size-5" aria-hidden /> {t("parent.home.addChild")}
          </LinkButton>
        </Card>
      ) : (
        <>
          {/* the week at a glance, for the whole family */}
          <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat tone="sky" icon={<Clock className="size-6" aria-hidden />} value={sum((c) => sel.dailyMinutes(db, c.id, 7).reduce((a, d) => a + d.minutes, 0))} label={t("parent.home.stat.minutes")} />
            <Stat tone="sun" icon={<Flame className="size-6" aria-hidden />} value={Math.max(...kids.map((c) => sel.streak(db, c.id)))} label={t("parent.home.stat.streak")} />
            <Stat tone="leaf" icon={<Star className="size-6" aria-hidden />} value={sum((c) => sel.weekActivities(db, c.id))} label={t("parent.home.stat.activities")} />
            <Stat tone="lavender" icon={<MessageCircle className="size-6" aria-hidden />} value={sum((c) => sel.aacStats(db, c.id).sentences)} label={t("parent.home.stat.sentences")} />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section aria-labelledby="kids-title">
              <SectionHead id="kids-title" title={t("parent.home.children")} subtitle={t("parent.home.childrenSub")} />
              <div className="grid gap-4 md:grid-cols-2">
                {kids.map((c) => {
                  const minutes = sel.dailyMinutes(db, c.id, 7).reduce((a, d) => a + d.minutes, 0);
                  const change = sel.changes(db, c.id)[0];
                  const now = sel.currentLevel(db, c.id);
                  return (
                    <Link key={c.id} href={`/parent/child/${c.id}`} className="group rounded-fk focus-visible:outline-none">
                      <Card className="flex h-full flex-col gap-4 transition group-hover:shadow-lift group-focus-visible:ring-4 group-focus-visible:ring-teal">
                        <div className="flex items-center gap-4">
                          <Avatar emoji={c.avatar} size={56} tone="lavender" />
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-xl font-extrabold">{c.name}</h3>
                            <p className="text-sm text-muted">
                              {t("common.years", { n: age(c.birthYear) })} · {t("parent.home.learns", { lang: t(`lang.${c.learningLang}`) })}
                            </p>
                          </div>
                          <ChevronRight className="size-5 text-muted transition group-hover:translate-x-1" aria-hidden />
                        </div>
                        {/* where the child is now — "continue learning" */}
                        <div className="rounded-2xl border border-line p-3">
                          {now ? (
                            <>
                              <div className="mb-2 flex items-center gap-3">
                                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl" aria-hidden>
                                  {now.level.emoji}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-extrabold text-ink">{t("parent.home.level", { n: now.level.n, title: now.level.title[lang] })}</p>
                                  <p className="text-xs text-muted">{t("parent.home.levelProgress", { done: now.done, total: now.total })}</p>
                                </div>
                              </div>
                              <Meter value={now.total ? now.done / now.total : 0} label={t("parent.home.level", { n: now.level.n, title: now.level.title[lang] })} />
                            </>
                          ) : (
                            <p className="text-sm font-bold text-ink-2">{t("parent.home.allDone")}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Chip tone="sun">
                            <Flame className="size-3.5" aria-hidden /> {t("parent.home.streak", { n: sel.streak(db, c.id) })}
                          </Chip>
                          <Chip tone="sky">
                            <Clock className="size-3.5" aria-hidden /> {t("parent.home.week", { n: minutes })}
                          </Chip>
                        </div>
                        <p className="mt-auto text-sm text-ink-2">
                          <span className="block text-xs font-bold text-muted">{t("parent.home.lastChange")}</span>
                          {change ? t(change.reasonKey) : t("parent.home.noChanges")}
                        </p>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* right column: what adults around the child suggest */}
            <aside aria-labelledby="sugg-title">
              <Card className="p-4">
                <SectionHead id="sugg-title" title={t("parent.home.suggestions")} subtitle={t("parent.home.suggestionsSub")} />
                {suggestions.length === 0 ? (
                  <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">{t("parent.home.noSuggestions")}</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {suggestions.map(({ a, child }) => {
                      const level = LEVEL_BY_ID[a.levelId];
                      const by = sel.user(db, a.byUserId);
                      return (
                        <li key={a.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-soft text-xl" aria-hidden>
                            {level?.emoji}
                          </span>
                          <div className="min-w-0 space-y-1">
                            <span className="block font-extrabold">{level?.title[lang]}</span>
                            <div className="flex flex-wrap gap-1.5">
                              <Chip tone={a.kind === "therapist" ? "lavender" : "leaf"}>
                                {a.kind === "therapist" ? <Stethoscope className="size-3.5" aria-hidden /> : <School className="size-3.5" aria-hidden />}
                                {t(a.kind === "therapist" ? "role.therapist" : "role.teacher")}
                              </Chip>
                              <Chip tone="gray">{child.name}</Chip>
                            </div>
                            {a.note && <p className="text-sm text-ink-2">{a.note}</p>}
                            <LockNote childId={child.id} levelId={a.levelId} />
                            <p className="text-xs text-muted">
                              {by?.name}
                              {a.due && ` · ${t("parent.home.due", { date: fmtDate(a.due, lang) })}`}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </aside>
          </div>
        </>
      )}
    </>
  );
}

function SectionHead({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="text-lg font-extrabold text-ink">
        {title}
      </h2>
      <p className="text-sm text-muted">{subtitle}</p>
    </div>
  );
}
