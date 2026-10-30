"use client";

import { useState } from "react";
import { CalendarPlus, LocateFixed, MapPin, Phone, Send } from "lucide-react";
import { Button, Card, Chip, Empty, LinkButton, PageHeader, Textarea, useAction } from "@/components/ui";
import { needsFor } from "@/content/places";
import { districtName, regionName } from "@/content/districts";
import { fmtDate, fmtSum } from "@/lib/format";
import { api, sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import type { GoalKey, Place, PlaceNeed, ReportReason } from "@/lib/types";

// B34 (spec §11): the parent picks a need in plain words; free state centres first, then private places by distance.
// "I'm not sure" never guesses: it suggests the child's doctor or a free state centre. Game results are never used
// to send a family to a particular doctor (that would be a medical referral).

type Pick = PlaceNeed | "unsure";
const REASONS: ReportReason[] = ["wrong_price", "closed", "other"];

function Report({ place }: { place: Place }) {
  const t = useT();
  const db = useDb();
  const me = sel.me(db);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("wrong_price");
  const [note, setNote] = useState("");
  const send = useAction(api.reportPlace);
  if (me && sel.placeReported(db, place.id, me.id)) return <p role="status" className="text-sm font-semibold text-teal">{t("help.report.thanks")}</p>;
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {t("help.report")}
      </Button>
    );
  return (
    <form
      className="space-y-2 rounded-2xl bg-surface-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        send.run(place.id, reason, note);
      }}
    >
      <fieldset className="flex flex-wrap gap-3 text-sm">
        <legend className="sr-only">{t("help.report")}</legend>
        {REASONS.map((r) => (
          <label key={r} className="inline-flex items-center gap-1.5">
            <input type="radio" name={`reason-${place.id}`} checked={reason === r} onChange={() => setReason(r)} /> {t(`help.reason.${r}`)}
          </label>
        ))}
      </fieldset>
      <Textarea maxLength={500} aria-label={t("help.report.note")} placeholder={t("help.report.note")} value={note} onChange={(e) => setNote(e.target.value)} />
      <Button type="submit" size="sm" pending={send.pending}>
        <Send className="size-4" aria-hidden /> {t("help.report.send")}
      </Button>
      {send.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{send.error}</p>}
    </form>
  );
}

function PlaceCard({ place }: { place: Place & { distanceKm?: number } }) {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const price =
    place.kind === "state_centre" && place.priceMin === undefined
      ? t("help.free")
      : place.priceMin !== undefined
        ? t("help.price", { min: fmtSum(place.priceMin * 100), max: fmtSum((place.priceMax ?? place.priceMin) * 100) })
        : t("help.priceUnknown");
  return (
    <Card as="li" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-extrabold text-ink">{place.name}</h2>
        <div className="flex flex-wrap gap-1.5">
          {place.sample && <Chip tone="sun">{t("help.sample")}</Chip>}
          <Chip tone={place.kind === "state_centre" ? "leaf" : "sky"}>{t(`help.kind.${place.kind}`)}</Chip>
        </div>
      </div>
      <p className="text-sm text-ink-2">
        {[districtName(place.district, lang), regionName(place.region, lang), place.address].filter(Boolean).join(" · ")}
        {place.distanceKm !== undefined && ` · ${t("help.km", { n: place.distanceKm.toFixed(1) })}`}
      </p>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <div><dt className="inline font-bold">{t("help.ages")}: </dt><dd className="inline">{t("help.agesValue", { min: place.ageMin, max: place.ageMax })}</dd></div>
        <div><dt className="inline font-bold">{t("help.cp")}: </dt><dd className="inline">{t(place.worksWithCp ? "plans.yes" : "plans.no")}</dd></div>
        <div><dt className="inline font-bold">{t("help.languages")}: </dt><dd className="inline">{place.languages.map((l) => t(`lang.${l}`)).join(", ")}</dd></div>
        <div><dt className="inline font-bold">{t("help.priceLabel")}: </dt><dd className="inline">{price}</dd></div>
      </dl>
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {t("help.checked", { date: fmtDate(place.checkedAt, lang) })}
        {sel.priceOld(place) && <Chip tone="sun">{t("help.priceOld")}</Chip>}
      </p>
      <div className="flex flex-wrap gap-2">
        {place.phone && (
          <a href={`tel:${place.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-bold text-primary">
            <Phone className="size-4" aria-hidden /> {place.phone}
          </a>
        )}
        {place.telegram && (
          <a href={`https://t.me/${place.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-full border border-line px-3 text-sm font-bold text-primary">
            Telegram
          </a>
        )}
        {place.mapUrl && (
          <a href={place.mapUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-bold text-primary">
            <MapPin className="size-4" aria-hidden /> {t("help.map")}
          </a>
        )}
      </div>
      {sel.freeSlots(db, place.id).length > 0 && (
        <LinkButton href={`/parent/help/${place.id}`} size="sm">
          <CalendarPlus className="size-4" aria-hidden /> {t("book.cta")}
        </LinkButton>
      )}
      <Report place={place} />
    </Card>
  );
}

/** The family's visits (B35): time, place, in person or online, status; the online link once the clinic confirms. */
function Visits() {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const me = sel.me(db);
  const cancel = useAction(api.cancelBooking);
  const visits = me ? sel.childrenOf(db, me.id).flatMap((c) => sel.bookingsOf(db, c.id).map((b) => ({ ...b, child: c }))) : [];
  if (visits.length === 0) return null;
  return (
    <Card className="mb-6 space-y-3">
      <h2 className="font-extrabold text-ink">{t("book.visits")}</h2>
      <ul className="space-y-2">
        {visits.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {fmtDate(v.slot.startsAt, lang, "visit")} · {v.place?.name}
              </span>
              <span className="block text-muted">
                {v.child.name} · {t(`book.mode.${v.mode}`)}
              </span>
            </span>
            <Chip tone={v.status === "confirmed" ? "leaf" : v.status === "booked" ? "sky" : "gray"}>{t(`book.status.${v.status}`)}</Chip>
            {v.status === "confirmed" && v.onlineLink && (
              <a href={v.onlineLink} target="_blank" rel="noreferrer" className="font-bold text-primary underline">
                {t("book.join")}
              </a>
            )}
            {v.status !== "cancelled" && (
              <Button size="sm" variant="ghost" pending={cancel.pending} onClick={() => cancel.run(v.childId, v.id)}>
                {t("book.cancel")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {cancel.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{cancel.error}</p>}
    </Card>
  );
}

export default function FindHelp() {
  const t = useT();
  const db = useDb();
  const me = sel.me(db);
  const [pick, setPick] = useState<Pick | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | undefined>();
  const [noPos, setNoPos] = useState(false);
  if (!me) return null;
  // The child's own goals (P33) put the most relevant needs first.
  const goals = sel.childrenOf(db, me.id).flatMap((c) => {
    const round = sel.intakeRound(db, c.id);
    const p33 = round ? sel.intakeAnswers(db, c.id, round.round).P33 : undefined;
    return Array.isArray(p33) ? (p33 as GoalKey[]) : [];
  });
  const picks: Pick[] = [...needsFor(goals), "unsure"];
  const places = pick === null ? [] : sel.places(db, pick === "unsure" ? null : pick, me, pos).filter((p) => pick !== "unsure" || p.kind === "state_centre");
  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setNoPos(true),
    );

  return (
    <>
      <PageHeader title={t("help.title")} subtitle={t("help.subtitle")} />
      <Visits />
      {sel.places(db, null, me).some((p) => p.sample) && (
        <p role="note" className="mb-4 rounded-2xl bg-sun-soft px-4 py-3 text-sm font-semibold text-ink">
          {t("help.sampleNote")}
        </p>
      )}
      <Card className="mb-6 space-y-3">
        <h2 id="need" className="font-extrabold text-ink">{t("help.need")}</h2>
        <div role="group" aria-labelledby="need" className="flex flex-wrap gap-2">
          {picks.map((n) => (
            <Button key={n} variant={pick === n ? "primary" : "outline"} aria-pressed={pick === n} onClick={() => setPick(n)}>
              {t(`help.need.${n}`)}
            </Button>
          ))}
        </div>
        {pick && pick !== "unsure" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={locate}>
              <LocateFixed className="size-4" aria-hidden /> {t("help.near")}
            </Button>
            {noPos && <span className="text-xs text-muted">{t("help.noPos")}</span>}
          </div>
        )}
      </Card>
      {pick === "unsure" && (
        <Card className="mb-4 border-teal bg-teal-soft/50">
          <p className="font-bold text-ink">{t("help.unsure")}</p>
        </Card>
      )}
      {pick !== null &&
        (places.length === 0 ? (
          <Empty>{t("help.none")}</Empty>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {places.map((p) => (
              <PlaceCard key={p.id} place={p} />
            ))}
          </ul>
        ))}
    </>
  );
}
