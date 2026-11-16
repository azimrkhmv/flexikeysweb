"use client";

import { useState } from "react";
import { Button, Card, Field, Input, Select, useAction } from "@/components/ui";
import { exerciseList } from "@/content/exercises";
import { FormError, FormNote } from "@/features/auth/parts";
import { api } from "@/lib/api";
import { LANG_NAMES, LANGS, useLang, useT, type Lang } from "@/lib/i18n";

/** The exercise list (the same ids as the server's exercises.json). */
const EXERCISES = exerciseList();

/** Admin: a finished video file for one exercise and language goes into the review queue. */
export function VideoRegister() {
  const t = useT();
  const [uiLang] = useLang();
  const [videoId, setVideoId] = useState(EXERCISES[0].id);
  const [lang, setLang] = useState<Lang>("uz");
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState(false);
  const upload = useAction(api.uploadVideo);
  return (
    <Card as="section" className="mt-8 max-w-2xl space-y-4 p-5">
      <h2 className="text-lg font-extrabold text-ink">{t("review.register.title")}</h2>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setDone(false);
          if (file && (await upload.run(videoId, lang, file)) !== undefined) {
            setFile(null);
            (e.target as HTMLFormElement).reset();
            setDone(true);
          }
        }}
      >
        <Field label={t("review.register.exercise")}>
          <Select value={videoId} onChange={(e) => setVideoId(e.target.value)}>
            {EXERCISES.map((v) => <option key={v.id} value={v.id}>{v.title[uiLang]}</option>)}
          </Select>
        </Field>
        <Field label={t("review.register.lang")}>
          <Select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("review.register.file")}>
            <Input required type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <FormError>{upload.error}</FormError>
          {done && <FormNote>{t("review.done")}</FormNote>}
          <Button type="submit" pending={upload.pending}>{t("review.register.submit")}</Button>
        </div>
      </form>
    </Card>
  );
}
