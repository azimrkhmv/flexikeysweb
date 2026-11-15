"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar, Card, LinkButton, PageHeader } from "@/components/ui";
import { QUICK_START } from "@/features/parent/FirstScreen";
import { PlanTab } from "@/features/intake/PlanTab";
import { age } from "@/features/parent/lib";
import { sel, useDb } from "@/lib/api";
import { useT } from "@/lib/i18n";

/**
 * "Plan" (B100, spec 2.4): the child's plan and progress. It reuses the existing child page and its tabs: one child
 * shows the plan here with the way to the other tabs; several children are a list to choose from.
 */
export default function PlanPage() {
  const t = useT();
  const db = useDb();
  const me = sel.me(db);
  if (!me) return null;
  const kids = sel.childrenOf(db, me.id);

  return (
    <>
      <PageHeader title={t("planpage.title")} subtitle={t("planpage.subtitle")} />
      {kids.length === 0 ? (
        <Card className="flex flex-col items-start gap-4">
          <p className="max-w-xl text-ink-2">{t("planpage.none")}</p>
          <LinkButton href={QUICK_START}>{t("first.start")}</LinkButton>
        </Card>
      ) : (
        <div className="space-y-8">
          {kids.map((c) => (
            <section key={c.id} aria-labelledby={`plan-${c.id}`} className="space-y-4">
              <Link href={`/parent/child/${c.id}`} className="group inline-flex items-center gap-3 rounded-2xl">
                <Avatar emoji={c.avatar} size={48} tone="lavender" />
                <span>
                  <span id={`plan-${c.id}`} className="block text-xl font-extrabold text-ink">
                    {c.name}
                  </span>
                  <span className="block text-sm text-muted">
                    {t("common.years", { n: age(c.birthYear) })} · {t("parent.tab.progress")}
                  </span>
                </span>
                <ChevronRight className="size-5 text-muted transition group-hover:translate-x-1" aria-hidden />
              </Link>
              <PlanTab child={c} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
