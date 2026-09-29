"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Avatar, Card, Chip, Empty, PageHeader } from "@/components/ui";
import { AdaptationLog, fmtDate, LevelLabel, MasteryList, MinutesChart, NotFound, SectionTitle, SessionsList, useMe } from "@/features/pro/shared";
import { sel } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

/** Read-only child view for the teacher of an enrolled class (PRD §9.15). */
export default function TeacherChild() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const [lang] = useLang();
  const { db, me } = useMe();
  const child = sel.child(db, id);
  if (!child || sel.access(db, me.id, id) !== "teacher") return <NotFound back="/teacher" />;
  const classes = sel.classesOf(db, me.id).filter((k) => db.enrollments.some((e) => e.classId === k.id && e.childId === id));
  const tasks = sel.assignmentsFor(db, id);

  return (
    <>
      <Link href={classes[0] ? `/teacher/class/${classes[0].id}` : "/teacher"} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-primary">
        <ArrowLeft className="size-4" aria-hidden /> {classes[0]?.name ?? t("teacher.nav.classes")}
      </Link>
      <div className="mb-6 flex items-center gap-4 [&>div:last-child]:mb-0">
        <Avatar emoji={child.avatar} size={64} />
        <PageHeader title={child.name} subtitle={<Chip tone="gray">{t("pro.readOnly")}</Chip>} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <MasteryList childId={id} />
        <div className="space-y-6">
          <MinutesChart childId={id} days={7} />
          <Card>
            <SectionTitle>{t("teacher.tasks.title")}</SectionTitle>
            {tasks.length === 0 ? (
              <Empty />
            ) : (
              <ul className="divide-y divide-line text-sm">
                {tasks.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <div className="font-bold text-ink">
                      <LevelLabel levelId={a.levelId} />
                    </div>
                    <div className="text-muted">
                      {t(a.kind === "therapist" ? "pro.fromTherapist" : "pro.fromTeacher")}
                      {a.due ? ` · ${t("teacher.tasks.dueOn", { date: fmtDate(a.due, lang) })}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <AdaptationLog childId={id} />
        <SessionsList childId={id} />
      </div>
    </>
  );
}
