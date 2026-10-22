"use client";

import { useEffect, useState } from "react";
import { Button, Card, Empty, Textarea, useAction } from "@/components/ui";
import { SectionTitle, useMe } from "@/features/pro/shared";
import { api, sel } from "@/lib/api";
import {  } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { getMedia } from "@/lib/media";

// B25, B29: the parent's movement clips (P40) and feedback clips (one exercise, filmed from Today), for a shared
// therapist only, with the movement-videos consent. The therapist watches and replies (T9). AI never analyses them.

function ClipVideo({ clipId, label, link }: { clipId: string; label: string; link?: string }) {
  const [local, setUrl] = useState<string | null>(null);
  const url = link ?? local; // live: a link from the server; demo: the file kept on this device
  useEffect(() => {
    if (link) return;
    let made: string | null = null;
    getMedia(clipId).then((blob) => {
      if (!blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      if (made) URL.revokeObjectURL(made);
    };
  }, [clipId, link]);
  return url ? <video src={url} controls aria-label={label} className="w-full rounded-2xl bg-ink" /> : <div className="aspect-video w-full rounded-2xl bg-surface-2" aria-label={label} />;
}

export function Clips({ childId }: { childId: string }) {
  const t = useT();
  const [lang] = useLang();
  const { db } = useMe();
  const feedback = sel.feedbackClips(db, childId);
  const clips = [
    ...sel.movementClips(db, childId).map((id, i) => ({ id, label: t("tclips.clip", { n: i + 1 }) })),
    ...feedback.map((c) => ({ id: c.id, label: t("tclips.exercise", { name: sel.video(db, c.exerciseId)?.title[lang] ?? c.exerciseId }) })),
  ];
  const reply = useAction(api.replyToClip);
  const [text, setText] = useState<Record<string, string>>({});

  return (
    <Card>
      <SectionTitle>{t("tclips.title")}</SectionTitle>
      {clips.length === 0 ? (
        <Empty>{t("tclips.none")}</Empty>
      ) : (
        <ul className="space-y-5">
          {clips.map(({ id: c, label }) => (
            <li key={c} className="space-y-2">
              <p className="text-sm font-bold text-ink">{label}</p>
              <ClipVideo clipId={c} label={label} link={sel.clipUrl(db, c)} />
              {sel.clipReplies(db, childId, c).map((r) => (
                <p key={r.id} className="rounded-2xl bg-surface-2 p-3 text-sm text-ink">
                  {r.text} <span className="text-xs text-muted">· {fmtDate(r.at, lang, "dayMonth")}</span>
                </p>
              ))}
              <form
                className="flex flex-col gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if ((await reply.run(childId, c, text[c] ?? "")) !== undefined) setText((x) => ({ ...x, [c]: "" }));
                }}
              >
                <Textarea
                  required
                  maxLength={1000}
                  aria-label={t("tclips.reply", { name: label })}
                  placeholder={t("tclips.reply", { name: label })}
                  value={text[c] ?? ""}
                  onChange={(e) => setText((x) => ({ ...x, [c]: e.target.value }))}
                />
                <Button type="submit" size="sm" variant="soft" pending={reply.pending} className="self-start">
                  {t("tclips.send")}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {reply.error && <p className="mt-2 text-sm font-semibold text-[#8f3a2c]">{reply.error}</p>}
    </Card>
  );
}
