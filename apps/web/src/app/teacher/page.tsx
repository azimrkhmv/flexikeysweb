"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Plus, Users } from "lucide-react";
import { Button, Chip, Empty, Field, Input, Modal, PageHeader, Select, useAction } from "@/components/ui";
import { useMe } from "@/features/pro/shared";
import { api, sel } from "@/lib/api";
import { LANGS, useLang, useT, type Lang } from "@/lib/i18n";

export default function TeacherClasses() {
  const t = useT();
  const { db, me } = useMe();
  const classes = sel.classesOf(db, me.id);
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title={t("teacher.classes.title")}
        subtitle={t("teacher.classes.subtitle")}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden />
            {t("teacher.classes.new")}
          </Button>
        }
      />
      {classes.length === 0 ? (
        <Empty>{t("teacher.classes.empty")}</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((k) => {
            const kids = sel.classChildren(db, k.id);
            const tasks = sel.classAssignments(db, k.id).length;
            return (
              <li key={k.id}>
                <Link href={`/teacher/class/${k.id}`} className="block h-full rounded-fk border border-line bg-surface p-5 shadow-soft transition hover:shadow-lift">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-extrabold text-ink">{k.name}</h2>
                      <p className="text-sm text-muted">{k.grade}</p>
                    </div>
                    <ChevronRight className="size-5 text-muted" aria-hidden />
                  </div>
                  <div className="mt-4 flex -space-x-2">
                    {kids.slice(0, 6).map((c) => (
                      <span key={c.id} className="grid size-9 place-items-center rounded-full border-2 border-surface bg-sky-soft text-lg" aria-hidden>
                        {c.avatar}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Chip tone="sky">
                      <Users className="size-3.5" aria-hidden /> {t("teacher.classes.children", { n: kids.length })}
                    </Chip>
                    <Chip tone="lavender">{t(`lang.${k.learningLang}`)}</Chip>
                    <Chip tone="sun">{t("teacher.classes.tasks", { n: tasks })}</Chip>
                    <Chip tone="teal" className="font-mono tracking-widest">
                      {k.code}
                    </Chip>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <CreateClass open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function CreateClass({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [lang] = useLang();
  const router = useRouter();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [learningLang, setLearningLang] = useState<Lang>(lang);
  const { run, pending, error } = useAction(api.createClass);

  return (
    <Modal open={open} onClose={onClose} title={t("teacher.classes.new")}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const k = await run({ name: name.trim(), grade: grade.trim(), learningLang });
          if (k) router.push(`/teacher/class/${k.id}`);
        }}
      >
        <Field label={t("teacher.classes.name")}>
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("teacher.classes.namePh")} />
        </Field>
        <Field label={t("teacher.classes.grade")}>
          <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder={t("teacher.classes.gradePh")} />
        </Field>
        <Field label={t("teacher.classes.learningLang")} hint={t("teacher.classes.learningLangHint")}>
          <Select value={learningLang} onChange={(e) => setLearningLang(e.target.value as Lang)}>
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {t(`lang.${l}`)}
              </option>
            ))}
          </Select>
        </Field>
        {error && (
          <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" pending={pending}>
            {t("teacher.classes.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
