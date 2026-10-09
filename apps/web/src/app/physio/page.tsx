"use client";

import { useState } from "react";
import { Button, Card, Chip, Empty, Field, Input, PageHeader, Select, Textarea, useAction } from "@/components/ui";
import { FormError, FormNote } from "@/features/auth/parts";
import { api, sel, useDb } from "@/lib/api";
import { LANG_NAMES, LANGS, useLang, useT, type Lang } from "@/lib/i18n";
import type { ExerciseVideo, VideoStatus } from "@/lib/types";

// Spec §8: generated → physio review (approve / reject / request changes with a note) → published.
// Only approved language versions can enter a roadmap (sel.usableVideos).

const STATUSES: VideoStatus[] = ["generated", "changes_requested", "rejected", "approved"];

export default function PhysioReview() {
  const t = useT();
  const db = useDb();
  const me = sel.me(db)!;
  const [status, setStatus] = useState<VideoStatus>("generated");
  const items = sel.videosByStatus(db, status);
  return (
    <>
      <PageHeader title={t("review.title")} subtitle={t("review.lead")} />
      <div className="mb-6 max-w-xs">
        <Field label={t("review.filter")}>
          <Select value={status} onChange={(e) => setStatus(e.target.value as VideoStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`review.status.${s}`)} ({sel.videosByStatus(db, s).length})
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {items.length === 0 ? <Empty>{t("review.empty")}</Empty> : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {items.map(({ video, lang }) => <Item key={`${video.id}/${lang}`} video={video} lang={lang} />)}
        </ul>
      )}
      {me.role === "admin" && <Register />}
    </>
  );
}

function Item({ video, lang }: { video: ExerciseVideo; lang: Lang }) {
  const t = useT();
  const db = useDb();
  const [uiLang] = useLang();
  const ver = video.versions[lang]!;
  const [note, setNote] = useState("");
  const review = useAction(api.reviewVideo);
  const name = (id?: string) => (id && sel.user(db, id)?.name) || "—";
  const decide = async (s: Exclude<VideoStatus, "generated">) => {
    if (await review.run(video.id, lang, s, note) !== undefined) setNote("");
  };
  return (
    <Card as="li" className="space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-extrabold text-ink">{video.title[uiLang]}</h2>
        <Chip tone="lavender">{LANG_NAMES[lang]}</Chip>
      </div>
      {ver.url ? (
        <video src={ver.url} controls preload="metadata" className="aspect-video w-full rounded-2xl bg-ink" />
      ) : (
        <div className="grid aspect-video w-full place-items-center rounded-2xl bg-surface-2 p-4 text-center text-sm text-muted">{t("review.noFile")}</div>
      )}
      <div className="flex flex-wrap gap-1.5 text-xs" aria-label={t("review.tags")}>
        <Chip tone="sky">{t(`area.${video.bodyArea}`)}</Chip>
        {video.goals.map((g) => <Chip key={g} tone="leaf">{t(`intake.P33.${g}`)}</Chip>)}
        <Chip tone="sun">{t("review.difficulty", { n: video.difficulty })}</Chip>
        <Chip tone="sky">{t("review.gmfcs", { levels: video.gmfcs.map((n) => ["I", "II", "III", "IV", "V"][n - 1]).join(" ") })}</Chip>
        <Chip tone="sky">{t("review.ages", { ages: video.ages.join(", ") })}</Chip>
        {video.tool && <Chip tone="teal">{t(`tool.${video.tool}`)}</Chip>}
        {video.conflicts.length > 0 && <Chip tone="peach">{t("review.conflicts", { list: video.conflicts.map((c) => t(`restr.${c}`)).join(", ") })}</Chip>}
      </div>
      {ver.status === "approved" && ver.approvedAt && <p className="text-sm text-ink-2">{t("review.approvedBy", { name: name(ver.approvedBy), date: new Date(ver.approvedAt).toLocaleDateString() })}</p>}
      {ver.notes.length > 0 && (
        <div>
          <p className="text-sm font-bold text-ink">{t("review.history")}</p>
          <ul className="mt-1 space-y-1 text-sm text-ink-2">
            {ver.notes.map((n) => <li key={n.at}>{name(n.by)}: {n.text}</li>)}
          </ul>
        </div>
      )}
      <Field label={t("review.note")} hint={t("review.note.hint")}>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <FormError>{review.error}</FormError>
      <div className="flex flex-wrap gap-2">
        <Button pending={review.pending} disabled={ver.status === "approved"} onClick={() => decide("approved")}>{t("review.approve")}</Button>
        <Button variant="outline" disabled={review.pending} onClick={() => decide("changes_requested")}>{t("review.changes")}</Button>
        <Button variant="ghost" disabled={review.pending} onClick={() => decide("rejected")}>{t("review.reject")}</Button>
      </div>
    </Card>
  );
}

/** Admin: a new file from the AI pipeline goes back into the review queue. */
function Register() {
  const t = useT();
  const db = useDb();
  const [uiLang] = useLang();
  const videos = sel.videos(db);
  const [videoId, setVideoId] = useState(videos[0]?.id ?? "");
  const [lang, setLang] = useState<Lang>("uz");
  const [url, setUrl] = useState("");
  const [done, setDone] = useState(false);
  const reg = useAction(api.registerVideo);
  return (
    <Card as="section" className="mt-8 max-w-2xl space-y-4 p-5">
      <h2 className="text-lg font-extrabold text-ink">{t("review.register.title")}</h2>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setDone(false);
          if ((await reg.run(videoId, lang, url, 90)) !== undefined) {
            setUrl("");
            setDone(true);
          }
        }}
      >
        <Field label={t("review.register.exercise")}>
          <Select value={videoId} onChange={(e) => setVideoId(e.target.value)}>
            {videos.map((v) => <option key={v.id} value={v.id}>{v.title[uiLang]}</option>)}
          </Select>
        </Field>
        <Field label={t("review.register.lang")}>
          <Select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("review.register.url")}>
            <Input required type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <FormError>{reg.error}</FormError>
          {done && <FormNote>{t("review.done")}</FormNote>}
          <Button type="submit" pending={reg.pending}>{t("review.register.submit")}</Button>
        </div>
      </form>
    </Card>
  );
}
