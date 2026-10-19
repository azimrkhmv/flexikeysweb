"use client";

import { useState } from "react";
import { Check, Plus, Trash, X } from "lucide-react";
import { Button, Card, Chip, Empty, Field, Input, PageHeader, Select, useAction } from "@/components/ui";
import { SectionTitle } from "@/features/pro/shared";
import { fmtDate } from "@/lib/format";
import { api, sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

// B36 (spec §11): a clinic publishes free times, confirms or cancels bookings and adds the online link. It sees only
// its own places; of a family it sees the child's first name and age and the parent's phone, which the family gives
// by booking.

const MINUTES = [30, 45, 60, 90];

function AddSlot({ placeId }: { placeId: string }) {
  const t = useT();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [minutes, setMinutes] = useState(45);
  const [specialist, setSpecialist] = useState("");
  const [inPerson, setInPerson] = useState(true);
  const [online, setOnline] = useState(false);
  const add = useAction(api.addSlot);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        // The clinic's own clock is Tashkent time.
        const startsAt = new Date(`${date}T${time}:00+05:00`).toISOString();
        if ((await add.run(placeId, { startsAt, minutes, specialist: specialist.trim() || undefined, inPerson, online })) !== undefined) setDate("");
      }}
    >
      <Field label={t("clinic.date")}>
        <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label={t("clinic.time")}>
        <Input type="time" required step={300} value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      <Field label={t("clinic.minutes")}>
        <Select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {t("plan.minutes", { n: m })}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("clinic.specialist")}>
        <Input maxLength={80} value={specialist} onChange={(e) => setSpecialist(e.target.value)} />
      </Field>
      <fieldset className="flex flex-wrap items-end gap-4 text-sm">
        <legend className="sr-only">{t("book.mode")}</legend>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={inPerson} onChange={(e) => setInPerson(e.target.checked)} /> {t("book.mode.in_person")}
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> {t("book.mode.online")}
        </label>
      </fieldset>
      <div className="flex items-end">
        <Button type="submit" pending={add.pending} disabled={!inPerson && !online}>
          <Plus className="size-4" aria-hidden /> {t("clinic.add")}
        </Button>
      </div>
      {add.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c] sm:col-span-full">{add.error}</p>}
    </form>
  );
}

function Bookings({ placeId }: { placeId: string }) {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const [links, setLinks] = useState<Record<string, string>>({});
  const confirm = useAction(api.confirmBooking);
  const cancel = useAction(api.clinicCancelBooking);
  const bookings = sel.clinicBookings(db, placeId);
  const year = new Date().getFullYear();
  if (bookings.length === 0) return <Empty>{t("clinic.noBookings")}</Empty>;
  return (
    <>
      <ul className="space-y-2">
        {bookings.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {fmtDate(b.slot.startsAt, lang, "visit")} · {t(`book.mode.${b.mode}`)}
              </span>
              <span className="block text-muted">
                {b.childName}
                {b.birthYear && `, ${t("clinic.age", { n: year - b.birthYear })}`}
                {b.parentPhone && ` · ${b.parentPhone}`}
              </span>
            </span>
            <Chip tone={b.status === "confirmed" ? "leaf" : b.status === "booked" ? "sky" : "gray"}>{t(`clinic.status.${b.status}`)}</Chip>
            {b.status === "booked" && (
              <>
                {b.mode === "online" && (
                  <Input
                    className="w-56"
                    type="url"
                    placeholder="https://"
                    aria-label={t("clinic.link")}
                    value={links[b.id] ?? ""}
                    onChange={(e) => setLinks((x) => ({ ...x, [b.id]: e.target.value }))}
                  />
                )}
                <Button size="sm" pending={confirm.pending} onClick={() => confirm.run(b.id, links[b.id])}>
                  <Check className="size-4" aria-hidden /> {t("clinic.confirm")}
                </Button>
              </>
            )}
            {b.status !== "cancelled" && (
              <Button size="sm" variant="ghost" pending={cancel.pending} onClick={() => cancel.run(b.id)}>
                <X className="size-4" aria-hidden /> {t("clinic.cancel")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {(confirm.error ?? cancel.error) && <p role="alert" className="mt-2 text-sm font-semibold text-[#8f3a2c]">{confirm.error ?? cancel.error}</p>}
    </>
  );
}

export default function ClinicDashboard() {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const me = sel.me(db);
  const places = me ? sel.clinicPlaces(db, me.id) : [];
  const [chosen, setChosen] = useState<string | null>(null);
  const remove = useAction(api.removeSlot);
  if (!me) return null;
  const place = places.find((p) => p.id === chosen) ?? places[0];
  if (!place) return <Empty>{t("clinic.noPlace")}</Empty>;
  const slots = sel.clinicSlots(db, place.id);

  return (
    <>
      <PageHeader title={place.name} subtitle={t("clinic.subtitle")} />
      {places.length > 1 && (
        <Field label={t("clinic.place")}>
          <Select value={place.id} onChange={(e) => setChosen(e.target.value)}>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="space-y-6">
        <Card>
          <SectionTitle>{t("clinic.bookings")}</SectionTitle>
          <Bookings placeId={place.id} />
        </Card>
        <Card className="space-y-4">
          <SectionTitle>{t("clinic.publish")}</SectionTitle>
          <AddSlot placeId={place.id} />
        </Card>
        <Card>
          <SectionTitle>{t("clinic.times")}</SectionTitle>
          {slots.length === 0 ? (
            <Empty />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-2xl border border-line p-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{fmtDate(s.startsAt, lang, "visit")}</span>
                    <span className="block text-muted">
                      {t("plan.minutes", { n: s.minutes })}
                      {s.specialist && ` · ${s.specialist}`} · {[s.inPerson && t("book.mode.in_person"), s.online && t("book.mode.online")].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  {s.booked ? (
                    <Chip tone="leaf">{t("clinic.taken")}</Chip>
                  ) : (
                    <Button size="sm" variant="ghost" pending={remove.pending} onClick={() => remove.run(place.id, s.id)} aria-label={t("clinic.remove", { time: fmtDate(s.startsAt, lang, "visit") })}>
                      <Trash className="size-4" aria-hidden />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {remove.error && <p role="alert" className="mt-2 text-sm font-semibold text-[#8f3a2c]">{remove.error}</p>}
        </Card>
      </div>
    </>
  );
}
