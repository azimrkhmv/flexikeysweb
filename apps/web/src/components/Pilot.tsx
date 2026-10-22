"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import { Button, Card, Textarea, useAction } from "@/components/ui";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

// The pilot with real parents: a "test version" banner (NEXT_PUBLIC_TEST_VERSION=1) and a "Send feedback" box on every
// signed-in page; admins read the messages in /admin/feedback.

export const TEST_VERSION = process.env.NEXT_PUBLIC_TEST_VERSION === "1";

export function TestBanner() {
  const t = useT();
  if (!TEST_VERSION) return null;
  return (
    <div role="note" className="mb-6 rounded-2xl border border-sun bg-sun-soft p-4 text-sm font-semibold text-[#7a5a0c]">
      {t("pilot.banner")}
    </div>
  );
}

export function FeedbackBox() {
  const t = useT();
  const page = usePathname();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const send = useAction(api.sendFeedback);

  if (!open)
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSent(false);
        }}
        className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white shadow-soft lg:bottom-6"
      >
        <MessageSquarePlus className="size-5" aria-hidden /> {t("feedback.button")}
      </button>
    );
  return (
    <Card className="fixed bottom-24 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] space-y-3 p-4 shadow-soft lg:bottom-6">
      <div className="flex items-start justify-between gap-2">
        <p className="font-extrabold text-ink">{t("feedback.title")}</p>
        <button type="button" onClick={() => setOpen(false)} aria-label={t("feedback.close")} className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-surface-2">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {sent ? (
        <p role="status" className="text-sm font-semibold text-teal">{t("feedback.sent")}</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (text.trim() && (await send.run(text, page)) !== undefined) {
              setText("");
              setSent(true);
            }
          }}
        >
          <Textarea aria-label={t("feedback.title")} rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("feedback.hint")} />
          {send.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{send.error}</p>}
          <Button type="submit" size="sm" pending={send.pending} disabled={!text.trim()}>
            {t("feedback.send")}
          </Button>
        </form>
      )}
    </Card>
  );
}
