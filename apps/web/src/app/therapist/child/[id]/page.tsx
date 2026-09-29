"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Trash } from "lucide-react";
import { aacCard } from "@/content/aac";
import { LEVELS } from "@/content/levels";
import { Avatar, Button, Card, Chip, Empty, Field, Input, PageHeader, Select, Textarea, Toggle, useAction } from "@/components/ui";
import { AdaptationLog, LevelLabel, LevelOptions, LockNote, MasteryList, MinutesChart, NotFound, SectionTitle, SessionsList, useMe, useNow } from "@/features/pro/shared";
import { fmtDate } from "@/lib/format";
import { api, sel } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

/** Therapist view of one linked child (PRD §9.16). Read-only for adaptation; every open is audit-logged. */
export default function TherapistChild() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { db, me } = useMe();
  const year = new Date(useNow()).getFullYear();
  const child = sel.child(db, id);
  const allowed = !!child && sel.access(db, me.id, id) === "therapist";
  const logged = useRef<string | null>(null);

  useEffect(() => {
    if (!allowed || logged.current === id) return;
    logged.current = id;
    api.logChildRead(id).catch(() => {});
  }, [allowed, id]);

  if (!allowed) return <NotFound back="/therapist" />;

  return (
    <>
      <Link href="/therapist" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-primary">
        <ArrowLeft className="size-4" aria-hidden /> {t("therapist.nav.children")}
      </Link>
      <div className="mb-2 flex items-center gap-4 [&>div:last-child]:mb-0">
        <Avatar emoji={child.avatar} size={64} />
        <PageHeader title={child.name} subtitle={t("common.years", { n: year - child.birthYear })} />
      </div>
      <p className="mb-6 text-xs text-muted">{t("therapist.child.audit")}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Notes childId={id} />
        <Goals childId={id} />
        <MasteryList childId={id} />
        <div className="space-y-6">
          <MinutesChart childId={id} />
          <Recommend childId={id} />
        </div>
        <AacUsage childId={id} />
        <AdaptationLog childId={id} limit={10} />
        <SessionsList childId={id} />
      </div>
    </>
  );
}

function Notes({ childId }: { childId: string }) {
  const t = useT();
  const [lang] = useLang();
  const { db, me } = useMe();
  const notes = sel.notes(db, childId, { authorId: me.id });
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(true);
  const { run, pending, error } = useAction(api.addNote);

  return (
    <Card>
      <SectionTitle>{t("therapist.notes.title")}</SectionTitle>
      <form
        className="mb-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (text.trim() && (await run(childId, text, visible))) setText("");
        }}
      >
        <Field label={t("therapist.notes.new")}>
          <Textarea required value={text} onChange={(e) => setText(e.target.value)} placeholder={t("therapist.notes.placeholder")} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-3 text-sm font-semibold text-ink">
            <Toggle checked={visible} onChange={setVisible} label={t("therapist.notes.visible")} />
            {t("therapist.notes.visible")}
          </label>
          <Button type="submit" size="sm" pending={pending}>
            {t("common.save")}
          </Button>
        </div>
        {error && <p className="text-sm font-semibold text-[#8f3a2c]">{error}</p>}
      </form>
      {notes.length === 0 ? (
        <Empty />
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-2xl bg-surface-2 p-3">
              <p className="whitespace-pre-line text-sm text-ink">{n.text}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                <span>{fmtDate(n.createdAt, lang, "dayMonth")}</span>
                <Chip tone={n.visibleToParent ? "teal" : "gray"}>{t(n.visibleToParent ? "therapist.notes.shared" : "therapist.notes.private")}</Chip>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Goals({ childId }: { childId: string }) {
  const t = useT();
  const { db } = useMe();
  const goals = sel.goals(db, childId);
  const [text, setText] = useState("");
  const add = useAction(api.addGoal);
  const toggle = useAction(api.toggleGoal);

  return (
    <Card>
      <SectionTitle>{t("therapist.goals.title")}</SectionTitle>
      {goals.length === 0 ? (
        <Empty />
      ) : (
        <ul className="mb-4 space-y-2">
          {goals.map((g) => (
            <li key={g.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
                <input type="checkbox" className="size-5 accent-teal" checked={g.done} onChange={() => toggle.run(g.id)} />
                <span className={`text-sm ${g.done ? "text-muted line-through" : "font-semibold text-ink"}`}>{g.text}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (text.trim() && (await add.run(childId, text))) setText("");
        }}
      >
        <Input required value={text} onChange={(e) => setText(e.target.value)} placeholder={t("therapist.goals.placeholder")} aria-label={t("therapist.goals.new")} />
        <Button type="submit" variant="soft" pending={add.pending}>
          {t("common.add")}
        </Button>
      </form>
      {(add.error || toggle.error) && <p className="mt-2 text-sm font-semibold text-[#8f3a2c]">{add.error || toggle.error}</p>}
    </Card>
  );
}

function Recommend({ childId }: { childId: string }) {
  const t = useT();
  const { db, me } = useMe();
  const list = sel.recommendations(db, childId);
  const [levelId, setLevelId] = useState(LEVELS[0].id);
  const [note, setNote] = useState("");
  const add = useAction(api.recommend);
  const del = useAction(api.deleteAssignment);

  return (
    <Card>
      <SectionTitle>{t("therapist.rec.title")}</SectionTitle>
      <p className="mb-3 text-sm text-muted">
        {t("therapist.rec.hint")} {t("pro.gateNote")}
      </p>
      <form
        className="mb-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await add.run(childId, levelId, note)) setNote("");
        }}
      >
        <Field label={t("teacher.tasks.level")}>
          <Select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
            <LevelOptions />
          </Select>
        </Field>
        <Field label={t("teacher.tasks.note")}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("therapist.rec.notePh")} />
        </Field>
        <Button type="submit" size="sm" pending={add.pending}>
          {t("therapist.rec.add")}
        </Button>
        {add.error && <p className="text-sm font-semibold text-[#8f3a2c]">{add.error}</p>}
      </form>
      {list.length === 0 ? (
        <Empty />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-ink">
                  <LevelLabel levelId={a.levelId} />
                </div>
                {a.note && <div className="text-muted">{a.note}</div>}
                <LockNote childId={childId} levelId={a.levelId} />
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

function AacUsage({ childId }: { childId: string }) {
  const t = useT();
  const [lang] = useLang();
  const { db } = useMe();
  const s = sel.aacStats(db, childId);
  const custom = sel.aacCustomCards(db, childId);
  const label = (cardId: string) => {
    const c = aacCard(cardId, lang, custom);
    return c ? `${c.emoji} ${c.label}` : cardId;
  };

  return (
    <Card>
      <SectionTitle>{t("therapist.aac.title")}</SectionTitle>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-sky-soft p-3">
          <div className="text-2xl font-extrabold text-ink">{s.sentences}</div>
          <div className="text-xs text-ink-2">{t("therapist.aac.sentences")}</div>
        </div>
        <div className="rounded-2xl bg-leaf-soft p-3">
          <div className="text-2xl font-extrabold text-ink">{s.avgLen}</div>
          <div className="text-xs text-ink-2">{t("therapist.aac.avgLen")}</div>
        </div>
      </div>
      {s.sentences === 0 ? (
        <Empty />
      ) : (
        <>
          <h3 className="mb-2 text-sm font-bold text-ink">{t("therapist.aac.top")}</h3>
          <div className="mb-4 flex flex-wrap gap-2">
            {s.top.map(([cardId, n]) => (
              <Chip key={cardId} tone="lavender">
                {label(cardId)} · {n}
              </Chip>
            ))}
          </div>
          <h3 className="mb-2 text-sm font-bold text-ink">{t("therapist.aac.recent")}</h3>
          <ul className="space-y-1 text-sm">
            {s.recent.map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span className="text-ink">{e.cardIds.map(label).join(" ")}</span>
                <span className="shrink-0 text-muted">{fmtDate(e.at, lang, "dayMonth")}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
