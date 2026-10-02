"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { Printer, Sparkles } from "lucide-react";
import { Avatar, Button, Card, Chip, Empty, Meter, PageHeader } from "@/components/ui";
import { LEVEL_BY_ID } from "@/content/levels";
import { sinceIso } from "@/features/parent/lib";
import { fmtDate } from "@/lib/format";
import { sel, useDb, type DB } from "@/lib/api";
import { useLang, useT, type Lang } from "@/lib/i18n";
import type { Child } from "@/lib/types";

// Weekly report built from the child's own data (PRD §9.14). "PDF" = the browser's print-to-PDF.
function Reports() {
  const t = useT();
  const db = useDb();
  const me = sel.me(db);
  const [printId, setPrintId] = useState<string | null>(null);
  if (!me) return null;
  const kids = sel.childrenOf(db, me.id);

  const print = (id: string) => {
    flushSync(() => setPrintId(id));
    window.print();
    setPrintId(null);
  };

  return (
    <>
      <style>{`@media print { header, nav { display: none !important; } body { background: #fff; } }`}</style>
      <div className="print:hidden">
        <PageHeader title={t("parent.reports.title")} subtitle={t("parent.reports.subtitle")} />
      </div>
      {kids.length === 0 ? (
        <Empty />
      ) : (
        <div className="space-y-6">
          {kids.map((c) => (
            <div key={c.id} className={printId && printId !== c.id ? "print:hidden" : ""}>
              <WeeklyReport db={db} child={c} onPrint={() => print(c.id)} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function WeeklyReport({ db, child, onPrint }: { db: DB; child: Child; onPrint: () => void }) {
  const t = useT();
  const [lang] = useLang();
  const from = sinceIso(7);
  const sessions = sel.sessions(db, child.id).filter((s) => s.startedAt >= from);
  const minutes = sessions.reduce((a, s) => a + (s.minutes ?? 0), 0);
  const activities = sessions.reduce((a, s) => a + s.activities, 0);
  const mastery = sel.mastery(db, child.id).filter((m) => m.attempts > 0).sort((a, b) => b.pKnown - a.pKnown);
  const changes = sel.changes(db, child.id).filter((c) => c.at >= from);
  const aac = sel.aacStats(db, child.id);
  // AI summary only with the child's AI consent and while the admin flag is on.
  const ai = sel.hasConsent(db, child.id, "ai_processing") && sel.flag(db, "ai_weekly_reports");

  return (
    <Card as="article" className="space-y-5 print:border-0 print:shadow-none">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar emoji={child.avatar} size={56} tone="lavender" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold">{t("parent.reports.week", { name: child.name })}</h2>
          <p className="text-sm text-muted">
            {fmtDate(from, lang)} — {t("common.today")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onPrint} className="print:hidden">
          <Printer className="size-4" aria-hidden /> {t("parent.reports.pdf")}
        </Button>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t("parent.reports.minutes"), minutes],
          [t("parent.reports.sessions"), sessions.length],
          [t("parent.reports.activities"), activities],
          [t("parent.reports.aac"), aac.sentences],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-surface-2 p-3">
            <dt className="text-xs font-bold text-muted">{k}</dt>
            <dd className="text-2xl font-extrabold">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-5 md:grid-cols-2">
        <section>
          <h3 className="mb-2 font-extrabold">{t("parent.reports.skills")}</h3>
          {mastery.length === 0 ? (
            <p className="text-sm text-muted">{t("common.none")}</p>
          ) : (
            <ul className="space-y-2">
              {mastery.slice(0, 5).map((m) => (
                <li key={m.skill} className="flex items-center gap-3 text-sm">
                  <span className="w-32 truncate font-semibold">{LEVEL_BY_ID[m.skill]?.title[lang]}</span>
                  <Meter value={m.pKnown} label={LEVEL_BY_ID[m.skill]?.title[lang] ?? m.skill} />
                  <span className="w-10 text-right font-bold">{Math.round(m.pKnown * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="mb-2 font-extrabold">{t("parent.reports.changes")}</h3>
          {changes.length === 0 ? (
            <p className="text-sm text-muted">{t("parent.reports.noChanges")}</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-ink-2">
              {changes.map((c) => (
                <li key={c.id}>• {t(c.reasonKey)}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {ai && (
        <section className="rounded-2xl bg-lavender-soft/60 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-extrabold">
            <Sparkles className="size-4" aria-hidden /> {t("parent.reports.ai")}
            <Chip tone="lavender">AI</Chip>
          </h3>
          <p className="whitespace-pre-line text-sm text-ink-2">{summary(t, lang, minutes, mastery.map((m) => m.skill))}</p>
          <p className="mt-2 text-xs text-muted">{t("ai.disclaimer")}</p>
        </section>
      )}
    </Card>
  );
}

// ponytail: rule-based summary from the same ai.parent.* templates the assistant uses; the real one is the ARQ weekly job.
function summary(t: (k: string, v?: Record<string, string | number>) => string, lang: Lang, minutes: number, skills: string[]) {
  const title = (id?: string) => (id ? LEVEL_BY_ID[id]?.title[lang] : "—") ?? "—";
  return [
    t("ai.parent.intro", { minutes }),
    t("ai.parent.strong", { skill: title(skills[0]) }),
    t("ai.parent.practice", { skill: title(skills[skills.length - 1]) }),
    t("ai.parent.tip"),
  ].join(" ");
}

// Live mode: not connected to the server yet (PRD Phase 5/6).
export default function Page() {
  return <Reports />;
}
