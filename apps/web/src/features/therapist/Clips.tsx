"use client";

import { useEffect, useState } from "react";
import { Button, Card, Empty, Textarea, useAction } from "@/components/ui";
import { SectionTitle, useMe } from "@/features/pro/shared";
import { api, sel } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { getMedia } from "@/lib/media";

// B25: the parent's movement clips (P40), for a shared therapist only, with the movement-videos consent. The
// therapist watches and replies (T9: notes per clip). AI never analyses them.

function ClipVideo({ clipId, label }: { clipId: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let made: string | null = null;
    getMedia(clipId).then((blob) => {
      if (!blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      if (made) URL.revokeObjectURL(made);
    };
  }, [clipId]);
  return url ? <video src={url} controls aria-label={label} className="w-full rounded-2xl bg-ink" /> : <div className="aspect-video w-full rounded-2xl bg-surface-2" aria-label={label} />;
}

export function Clips({ childId }: { childId: string }) {
  const t = useT();
  const [lang] = useLang();
  const { db } = useMe();
  const clips = sel.movementClips(db, childId);
  const reply = useAction(api.replyToClip);
  const [text, setText] = useState<Record<string, string>>({});

  return (
    <Card>
      <SectionTitle>{t("tclips.title")}</SectionTitle>
      {clips.length === 0 ? (
        <Empty>{t("tclips.none")}</Empty>
      ) : (
        <ul className="space-y-5">
          {clips.map((c, i) => (
            <li key={c} className="space-y-2">
              <ClipVideo clipId={c} label={t("tclips.clip", { n: i + 1 })} />
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
                  aria-label={t("tclips.reply", { n: i + 1 })}
                  placeholder={t("tclips.reply", { n: i + 1 })}
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
