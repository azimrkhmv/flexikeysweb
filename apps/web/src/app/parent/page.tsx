"use client";

import Link from "next/link";
import { ChevronRight, Clock, Flame, Play, Plus, School, Stethoscope } from "lucide-react";
import { Mascot } from "@/components/Mascot";
import { Avatar, Card, Chip, Empty, LinkButton, PageHeader } from "@/components/ui";
import { LEVEL_BY_ID } from "@/content/levels";
import { age, fmtDate } from "@/features/parent/lib";
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kids.map((c) => {
            const minutes = sel.dailyMinutes(db, c.id, 7).reduce((a, d) => a + d.minutes, 0);
            const change = sel.changes(db, c.id)[0];
            return (
              <Link key={c.id} href={`/parent/child/${c.id}`} className="group rounded-fk focus-visible:outline-none">
                <Card className="h-full transition group-hover:shadow-lift group-focus-visible:ring-4 group-focus-visible:ring-teal">
                  <div className="flex items-center gap-4">
                    <Avatar emoji={c.avatar} size={60} tone="lavender" />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-xl font-extrabold">{c.name}</h2>
                      <p className="text-sm text-muted">
                        {t("common.years", { n: age(c.birthYear) })} · {t("parent.home.learns", { lang: t(`lang.${c.learningLang}`) })}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-muted transition group-hover:translate-x-1" aria-hidden />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Chip tone="sun">
                      <Flame className="size-3.5" aria-hidden /> {t("parent.home.streak", { n: sel.streak(db, c.id) })}
                    </Chip>
                    <Chip tone="sky">
                      <Clock className="size-3.5" aria-hidden /> {t("parent.home.week", { n: minutes })}
                    </Chip>
                  </div>
                  <p className="mt-4 rounded-2xl bg-surface-2 p-3 text-sm text-ink-2">
                    {change ? (
                      <>
                        <span className="block text-xs font-bold uppercase tracking-wide text-muted">{t("parent.home.lastChange")}</span>
                        {t(change.reasonKey)}
                      </>
                    ) : (
                      t("parent.home.noChanges")
                    )}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {kids.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-extrabold">{t("parent.home.suggestions")}</h2>
          {suggestions.length === 0 ? (
            <Empty>{t("parent.home.noSuggestions")}</Empty>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {suggestions.map(({ a, child }) => {
                const level = LEVEL_BY_ID[a.levelId];
                const by = db.users.find((u) => u.id === a.byUserId);
                return (
                  <Card as="li" key={a.id} className="flex gap-4 p-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-soft text-2xl" aria-hidden>
                      {level?.emoji}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold">{level?.title[lang]}</span>
                        <Chip tone={a.kind === "therapist" ? "lavender" : "leaf"}>
                          {a.kind === "therapist" ? <Stethoscope className="size-3.5" aria-hidden /> : <School className="size-3.5" aria-hidden />}
                          {t(a.kind === "therapist" ? "role.therapist" : "role.teacher")}
                        </Chip>
                        <Chip tone="gray">{child.name}</Chip>
                      </div>
                      {a.note && <p className="text-sm text-ink-2">{a.note}</p>}
                      <p className="text-xs text-muted">
                        {by?.name}
                        {a.due && ` · ${t("parent.home.due", { date: fmtDate(a.due, lang) })}`}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
