"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, Copy, ExternalLink, Presentation, Printer, Sparkles, Trash, UserPlus, X } from "lucide-react";
import { Mascot } from "@/components/Mascot";
import { Avatar, Bars, Button, Card, Checkbox, Chip, Empty, Field, Input, Meter, Modal, PageHeader, Select, useAction } from "@/components/ui";
import { LEVELS } from "@/content/levels";
import {
  avgMastery, fmtDate, HeatLegend, heatBg, LevelLabel, LevelOptions, NotFound, pct, QrCode, SectionTitle, Table, td, th, useMe,
} from "@/features/pro/shared";
import { api, sel } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import type { Child, ClassRoom } from "@/lib/types";

const AVATARS = ["🐻", "🐱", "🐯", "🦋", "🐼", "🦊", "🐰", "🐸", "🦁", "🐨", "🐧", "🐢"];

export default function ClassPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { db, me } = useMe();
  const k = db.classes.find((c) => c.id === id && c.teacherId === me.id);
  const [classroom, setClassroom] = useState(false);
  if (!k) return <NotFound back="/teacher" />;
  const kids = sel.classChildren(db, k.id);
  const url = `${location.origin}/class?code=${k.code}`;

  return (
    <>
      <Link href="/teacher" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-primary">
        <ArrowLeft className="size-4" aria-hidden /> {t("teacher.nav.classes")}
      </Link>
      <PageHeader
        title={k.name}
        subtitle={[k.grade, t(`lang.${k.learningLang}`)].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> {t("teacher.code.print")}
            </Button>
            <Button
              variant="soft"
              onClick={() => {
                setClassroom(true);
                document.documentElement.requestFullscreen?.()?.catch(() => {});
              }}
            >
              <Presentation className="size-4" aria-hidden /> {t("teacher.classroom.open")}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Roster k={k} kids={kids} />
          <Heatmap kids={kids} />
          <Assignments k={k} />
        </div>
        <div className="space-y-6">
          <CodePanel k={k} url={url} />
          <AiHelper classId={k.id} />
        </div>
      </div>

      <Poster k={k} url={url} />
      {classroom && <Classroom k={k} kids={kids} url={url} onClose={() => setClassroom(false)} />}
    </>
  );
}

function CodePanel({ k, url }: { k: ClassRoom; url: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <Card>
      <SectionTitle>{t("teacher.code.title")}</SectionTitle>
      <p className="mb-3 text-sm text-muted">{t("teacher.code.hint")}</p>
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-teal-soft px-4 py-3">
        <span className="font-mono text-3xl font-black tracking-[0.2em] text-ink">{k.code}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard?.writeText(k.code);
            setCopied(true);
          }}
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? t("common.copied") : t("common.copy")}
        </Button>
      </div>
      <QrCode text={url} label={t("teacher.code.qr", { code: k.code })} className="mx-auto mt-4 max-w-56 rounded-xl" />
      <Link href={`/class?code=${k.code}`} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">
        <ExternalLink className="size-4" aria-hidden /> {t("teacher.code.openHere")}
      </Link>
    </Card>
  );
}

function Roster({ k, kids }: { k: ClassRoom; kids: Child[] }) {
  const t = useT();
  const [lang] = useLang();
  const { db, me } = useMe();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Child | null>(null);
  const remove = useAction(api.removeFromClass);

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>{t("teacher.roster.title", { n: kids.length })}</SectionTitle>
        <Button size="sm" onClick={() => setAdding(true)}>
          <UserPlus className="size-4" aria-hidden /> {t("teacher.roster.add")}
        </Button>
      </div>
      {kids.length === 0 ? (
        <Empty>{t("teacher.roster.empty", { code: k.code })}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>{t("teacher.roster.child")}</th>
              <th className={th}>{t("teacher.roster.mastery")}</th>
              <th className={th}>{t("teacher.roster.week")}</th>
              <th className={th}>{t("teacher.roster.last")}</th>
              <th className={th}>
                <span className="sr-only">{t("teacher.roster.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {kids.map((c) => {
              const avg = avgMastery(db, c.id);
              const week = sel.dailyMinutes(db, c.id, 7).reduce((a, d) => a + d.minutes, 0);
              const canView = sel.access(db, me.id, c.id) === "teacher";
              return (
                <tr key={c.id}>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <Avatar emoji={c.avatar} size={38} />
                      <div>
                        {canView ? (
                          <Link href={`/teacher/child/${c.id}`} className="font-bold text-primary hover:underline">
                            {c.name}
                          </Link>
                        ) : (
                          <span className="font-bold">{c.name}</span>
                        )}
                        <div>
                          <Chip tone={c.parentId ? "lavender" : "sky"} className="mt-0.5">
                            {t(c.parentId ? "teacher.roster.family" : "teacher.roster.school")}
                          </Chip>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={`${td} w-40`}>
                    <div className="mb-1 text-xs text-muted">{avg ? pct(avg) : "—"}</div>
                    <Meter value={avg} />
                  </td>
                  <td className={td}>{t("common.minutes", { n: week })}</td>
                  <td className={td}>{fmtDate(sel.sessions(db, c.id)[0]?.startedAt, lang)}</td>
                  <td className={`${td} text-right`}>
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(c)} aria-label={t("teacher.roster.removeX", { name: c.name })}>
                      <X className="size-4" aria-hidden />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <AddChild classId={k.id} open={adding} onClose={() => setAdding(false)} />
      <Modal open={!!removing} onClose={() => setRemoving(null)} title={t("teacher.roster.removeTitle", { name: removing?.name ?? "" })}>
        <p className="mb-5 text-ink-2">{t("teacher.roster.removeBody")}</p>
        {remove.error && <p className="mb-3 text-sm font-semibold text-[#8f3a2c]">{remove.error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRemoving(null)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            pending={remove.pending}
            onClick={async () => {
              if (removing && (await remove.run(k.id, removing.id))) setRemoving(null);
            }}
          >
            {t("teacher.roster.remove")}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

function AddChild({ classId, open, onClose }: { classId: string; open: boolean; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [attested, setAttested] = useState(false);
  const { run, pending, error } = useAction(api.addSchoolChild);

  return (
    <Modal open={open} onClose={onClose} title={t("teacher.add.title")}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(classId, { name, avatar, attested })) {
            setName("");
            setAttested(false);
            onClose();
          }
        }}
      >
        <p className="text-sm text-muted">{t("teacher.add.hint")}</p>
        <Field label={t("teacher.add.nickname")}>
          <Input required maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink">{t("teacher.add.avatar")}</legend>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={avatar === a}
                aria-label={a}
                onClick={() => setAvatar(a)}
                className={`grid size-12 place-items-center rounded-2xl text-2xl transition ${avatar === a ? "bg-teal-soft ring-2 ring-teal" : "bg-surface-2 hover:bg-sky-soft"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>
        <Checkbox checked={attested} onChange={setAttested} label={t("teacher.add.attest")} description={t("teacher.add.attestHint")} />
        {error && (
          <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" pending={pending} disabled={!attested || !name.trim()}>
            {t("common.add")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Heatmap({ kids }: { kids: Child[] }) {
  const t = useT();
  const [lang] = useLang();
  const { db } = useMe();
  const ranked = kids.map((c) => ({ c, avg: avgMastery(db, c.id) })).filter((x) => x.avg > 0).sort((a, b) => a.avg - b.avg);

  return (
    <Card>
      <SectionTitle>{t("teacher.heat.title")}</SectionTitle>
      <div className="mb-3">
        <HeatLegend />
      </div>
      {kids.length === 0 ? (
        <Empty />
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface px-2 text-left font-bold text-muted">{t("teacher.roster.child")}</th>
                {LEVELS.map((l) => (
                  <th key={l.id} title={`${l.n}. ${l.title[lang]}`} className="w-10 font-normal">
                    <span className="block text-base" aria-hidden>
                      {l.emoji}
                    </span>
                    <span className="text-muted">{l.n}</span>
                    <span className="sr-only">{l.title[lang]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kids.map((c) => {
                const m = sel.mastery(db, c.id);
                return (
                  <tr key={c.id}>
                    <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-surface px-2 text-left font-bold text-ink">
                      {c.avatar} {c.name}
                    </th>
                    {m.map((x) => (
                      <td key={x.skill} className="h-9 w-10 rounded-lg text-center font-bold text-ink" style={{ background: heatBg(x.pKnown, x.attempts) }}>
                        {x.attempts ? Math.round(x.pKnown * 100) : ""}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-bold text-ink">{t("teacher.heat.week")}</h3>
          <Bars data={kids.map((c) => ({ label: c.name, value: sel.dailyMinutes(db, c.id, 7).reduce((a, d) => a + d.minutes, 0) }))} unit=" min" tone="#b3a8e8" height={120} />
        </div>
        <div>
          <h3 className="mb-1 font-bold text-ink">{t("teacher.heat.support")}</h3>
          <p className="mb-2 text-sm text-muted">{t("teacher.heat.supportHint")}</p>
          {ranked.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {ranked.slice(0, 3).map(({ c, avg }) => (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-sun-soft/60 px-3 py-2">
                  <span aria-hidden>{c.avatar}</span>
                  <span className="font-bold text-ink">{c.name}</span>
                  <span className="ml-auto text-sm text-ink-2">{pct(avg)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function Assignments({ k }: { k: ClassRoom }) {
  const t = useT();
  const [lang] = useLang();
  const { db, me } = useMe();
  const list = db.assignments.filter((a) => a.classId === k.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [levelId, setLevelId] = useState(LEVELS[0].id);
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const add = useAction(api.assign);
  const del = useAction(api.deleteAssignment);

  return (
    <Card>
      <SectionTitle>{t("teacher.tasks.title")}</SectionTitle>
      <form
        className="mb-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await add.run({ classId: k.id, levelId, note: note.trim(), due: due ? new Date(`${due}T18:00:00`).toISOString() : undefined })) {
            setNote("");
            setDue("");
          }
        }}
      >
        <Field label={t("teacher.tasks.level")}>
          <Select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
            <LevelOptions />
          </Select>
        </Field>
        <Field label={t("teacher.tasks.note")}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("teacher.tasks.notePh")} />
        </Field>
        <Field label={t("teacher.tasks.due")}>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Button type="submit" pending={add.pending} className="h-12">
          {t("teacher.tasks.assign")}
        </Button>
      </form>
      {(add.error || del.error) && <p className="mb-3 text-sm font-semibold text-[#8f3a2c]">{add.error || del.error}</p>}
      {list.length === 0 ? (
        <Empty />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-ink">
                  <LevelLabel levelId={a.levelId} />
                </div>
                <div className="text-sm text-muted">
                  {[a.note, a.due && t("teacher.tasks.dueOn", { date: fmtDate(a.due, lang) })].filter(Boolean).join(" · ")}
                </div>
              </div>
              {a.byUserId === me.id && (
                <Button size="sm" variant="ghost" onClick={() => del.run(a.id)} aria-label={t("common.delete")}>
                  <Trash className="size-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AiHelper({ classId }: { classId: string }) {
  const t = useT();
  const [lang] = useLang();
  const { db } = useMe();
  const [text, setText] = useState("");
  const { run, pending, error } = useAction(api.teacherAiSummary);
  if (!db.flags.find((f) => f.key === "teacher_ai")?.enabled) return null;
  return (
    <Card className="bg-lavender-soft/40">
      <SectionTitle>
        <Sparkles className="mr-1 inline size-5 text-[#4f43a0]" aria-hidden />
        {t("teacher.ai.title")}
      </SectionTitle>
      <p className="mb-3 text-sm text-muted">{t("teacher.ai.hint")}</p>
      <Button
        variant="soft"
        pending={pending}
        onClick={async () => {
          const s = await run(classId, lang);
          if (s) setText(s);
        }}
      >
        {t(text ? "teacher.ai.again" : "teacher.ai.run")}
      </Button>
      {error && <p className="mt-3 text-sm font-semibold text-[#8f3a2c]">{error}</p>}
      {text && <p className="mt-4 whitespace-pre-line rounded-2xl bg-surface p-4 text-sm text-ink-2">{text}</p>}
    </Card>
  );
}

function Poster({ k, url }: { k: ClassRoom; url: string }) {
  const t = useT();
  return (
    <>
      <style>{`@media print { body * { visibility: hidden !important; } #fk-poster, #fk-poster * { visibility: visible !important; } #fk-poster { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      <section id="fk-poster" aria-hidden className="hidden text-center text-ink print:block">
        <Mascot mood="wave" size={220} float={false} />
        <h1 className="mt-2 text-4xl font-black">{t("teacher.poster.welcome", { name: k.name })}</h1>
        <ol className="mx-auto mt-6 max-w-xl space-y-2 text-left text-xl">
          <li>1. {t("teacher.poster.step1", { url: url.split("?")[0] })}</li>
          <li>2. {t("teacher.poster.step2")}</li>
          <li>3. {t("teacher.poster.step3")}</li>
        </ol>
        <p className="mt-8 font-mono text-7xl font-black tracking-[0.25em]">{k.code}</p>
        <div className="mx-auto mt-6 w-64">
          <QrCode text={url} label={k.code} />
        </div>
      </section>
    </>
  );
}

function Classroom({ k, kids, url, onClose }: { k: ClassRoom; kids: Child[]; url: string; onClose: () => void }) {
  const t = useT();
  return (
    <div role="dialog" aria-modal="true" aria-label={t("teacher.classroom.open")} className="fixed inset-0 z-50 overflow-y-auto bg-white p-6 text-[#15294d] sm:p-10">
      <button
        type="button"
        onClick={() => {
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
          onClose();
        }}
        className="fixed right-4 top-4 grid size-14 place-items-center rounded-full bg-[#15294d] text-white"
        aria-label={t("common.close")}
      >
        <X className="size-7" />
      </button>
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="text-2xl font-bold sm:text-3xl">{t("teacher.classroom.go", { url: url.split("?")[0] })}</p>
          <p className="mt-4 font-mono text-[clamp(3.5rem,11vw,9rem)] font-black leading-none tracking-[0.18em]">{k.code}</p>
          <p className="mt-4 text-xl font-semibold sm:text-2xl">{t("teacher.classroom.tap")}</p>
        </div>
        <QrCode text={url} label={k.code} className="rounded-2xl border-4 border-[#15294d]" />
      </div>
      <ul className="mx-auto mt-10 grid max-w-6xl grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-6">
        {kids.map((c) => (
          <li key={c.id} className="flex flex-col items-center gap-2 rounded-3xl border-2 border-[#15294d]/15 p-4">
            <span className="text-6xl" aria-hidden>
              {c.avatar}
            </span>
            <span className="text-xl font-extrabold">{c.name}</span>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center">
        <Link href={`/class?code=${k.code}`} className="inline-flex items-center gap-2 rounded-full bg-[#15294d] px-6 py-3 text-lg font-bold text-white">
          <ExternalLink className="size-5" aria-hidden /> {t("teacher.code.openHere")}
        </Link>
      </p>
    </div>
  );
}
