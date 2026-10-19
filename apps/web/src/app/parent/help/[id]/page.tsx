"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CalendarCheck } from "lucide-react";
import { Button, Card, Empty, Field, PageHeader, Select, useAction } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { api, sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import type { BookingMode } from "@/lib/types";

// B35 (spec §11): a clinic's free times; the parent books one, in person or online. A taken time is never offered,
// and the server refuses it if someone else was faster. The family pays the clinic directly.

export default function Book() {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const { id } = useParams<{ id: string }>();
  const me = sel.me(db);
  const place = sel.place(db, id);
  const kids = me ? sel.childrenOf(db, me.id) : [];
  const [child, setChild] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [mode, setMode] = useState<BookingMode>("in_person");
  const book = useAction(api.book);
  const [booked, setBooked] = useState(false);
  if (!me) return null;
  if (!place) return <Empty>{t("err.not_found")}</Empty>;
  const slots = sel.freeSlots(db, place.id);
  const slot = slots.find((s) => s.id === slotId);
  const childId = child ?? kids[0]?.id;
  const modes: BookingMode[] = slot ? (["in_person", "online"] as const).filter((m) => (m === "online" ? slot.online : slot.inPerson)) : [];

  return (
    <>
      <Link href="/parent/help" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
        <ArrowLeft className="size-4" aria-hidden /> {t("help.title")}
      </Link>
      <PageHeader title={t("book.title", { name: place.name })} subtitle={t("book.subtitle")} />
      {booked ? (
        <Card className="space-y-3">
          <p role="status" className="flex items-center gap-2 text-lg font-extrabold text-teal">
            <CalendarCheck className="size-5" aria-hidden /> {t("book.done")}
          </p>
          <p className="text-ink-2">{t("book.doneHint")}</p>
        </Card>
      ) : slots.length === 0 ? (
        <Empty>{t("book.none")}</Empty>
      ) : (
        <Card className="space-y-5">
          {kids.length > 1 && (
            <Field label={t("book.child")}>
              <Select value={childId} onChange={(e) => setChild(e.target.value)}>
                {kids.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <fieldset>
            <legend className="mb-2 font-bold text-ink">{t("book.time")}</legend>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-line p-3 has-checked:border-teal has-checked:bg-teal-soft/50">
                    <input
                      type="radio"
                      name="slot"
                      checked={slotId === s.id}
                      onChange={() => {
                        setSlotId(s.id);
                        setMode(s.inPerson ? "in_person" : "online");
                      }}
                    />
                    <span className="text-sm">
                      <span className="block font-bold">{fmtDate(s.startsAt, lang, "visit")}</span>
                      <span className="block text-muted">
                        {t("plan.minutes", { n: s.minutes })}
                        {s.specialist && ` · ${s.specialist}`}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {slot && (
            <fieldset>
              <legend className="mb-2 font-bold text-ink">{t("book.mode")}</legend>
              <div className="flex flex-wrap gap-3">
                {modes.map((m) => (
                  <label key={m} className="inline-flex items-center gap-1.5 text-sm">
                    <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} /> {t(`book.mode.${m}`)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <p className="text-xs text-muted">{t("book.payNote")}</p>
          <Button
            disabled={!slot || !childId}
            pending={book.pending}
            onClick={async () => {
              if (slot && childId && (await book.run(childId, slot.id, mode)) !== undefined) setBooked(true);
            }}
          >
            {t("book.submit")}
          </Button>
          {book.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{book.error}</p>}
        </Card>
      )}
    </>
  );
}
