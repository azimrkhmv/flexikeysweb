"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, Send, Sparkles, Trash } from "lucide-react";
import { Mascot } from "@/components/Mascot";
import { Button, Card, Input, useAction } from "@/components/ui";
import { api, sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

const SUGGESTED = ["parent.ai.q1", "parent.ai.q2", "parent.ai.q3"];

/** The assistant chat about one child: the parent's screen and the therapist dashboard (spec §12). Only the family's
 *  owner turns AI help on; a therapist sees `needConsent` instead. */
export function AssistantChat({ childId, needConsent }: { childId: string; needConsent?: string }) {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const me = sel.me(db);
  const [text, setText] = useState("");
  const ask = useAction(api.askAssistant);
  const clear = useAction(api.clearAssistant);
  const enable = useAction(api.setConsent);
  const end = useRef<HTMLDivElement>(null);
  const messages = me ? sel.aiMessages(db, me.id, childId) : [];

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, ask.pending]);

  if (!me) return null;
  const enabled = sel.flag(db, "ai_assistant", true);
  const consent = sel.hasConsent(db, childId, "ai_processing");

  const send = async (q: string) => {
    if (!q.trim()) return;
    setText("");
    await ask.run(childId, q.trim(), lang);
  };

  return (
    <Card className="flex min-h-[60vh] flex-col gap-4">
      <p role="note" className="rounded-2xl bg-sun-soft p-3 text-sm text-[#7a5a0c]">
        {t("ai.disclaimer")}
      </p>

      {!enabled ? (
        <p className="text-ink-2">{t("parent.ai.off")}</p>
      ) : !consent ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Mascot mood="thinking" size={120} />
          <p className="max-w-md text-ink-2">{needConsent ?? t("parent.ai.needConsent")}</p>
          {!needConsent && (
            <Button pending={enable.pending} onClick={() => enable.run(childId, "ai_processing", true)}>
              <Sparkles className="size-4" aria-hidden /> {t("parent.ai.enable")}
            </Button>
          )}
          {enable.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{enable.error}</p>}
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto" aria-live="polite">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-6 text-center text-ink-2">
                <Mascot mood="calm" size={110} />
                <p>{t("parent.ai.hello")}</p>
              </div>
            )}
            {messages.map((m) =>
              m.emergency && m.role === "assistant" ? (
                <div key={m.id} role="alert" className="space-y-3 rounded-3xl border-2 border-[#c0573f] bg-peach-soft p-4 text-ink">
                  <p className="text-[15px] font-bold">{m.text}</p>
                  <a href="tel:103" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#c0573f] px-5 font-extrabold text-white">
                    <Phone className="size-5" aria-hidden /> {t("ai.call103")}
                  </a>
                </div>
              ) : (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <p className={`max-w-[85%] whitespace-pre-line rounded-3xl px-4 py-3 text-[15px] ${m.role === "user" ? "rounded-br-lg bg-primary text-white" : "rounded-bl-lg bg-surface-2 text-ink"}`}>{m.text}</p>
                </div>
              ),
            )}
            {ask.pending && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Mascot mood="thinking" size={48} float={false} /> {t("parent.ai.thinking")}
              </div>
            )}
            <div ref={end} />
          </div>

          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((k) => (
              <button key={k} type="button" onClick={() => send(t(k))} disabled={ask.pending} className="rounded-full bg-teal-soft px-3 py-1.5 text-sm font-bold text-[#1f6b63] hover:brightness-95 disabled:opacity-50">
                {t(k)}
              </button>
            ))}
          </div>
          {ask.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{ask.error}</p>}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("parent.ai.placeholder")} aria-label={t("parent.ai.placeholder")} maxLength={500} />
            <Button type="submit" pending={ask.pending} aria-label={t("parent.ai.send")}>
              <Send className="size-4" aria-hidden />
            </Button>
          </form>
          {messages.length > 0 && (
            <button type="button" onClick={() => clear.run(childId)} className="inline-flex items-center gap-1 self-start text-sm font-bold text-muted hover:text-ink">
              <Trash className="size-4" aria-hidden /> {t("parent.ai.clear")}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
