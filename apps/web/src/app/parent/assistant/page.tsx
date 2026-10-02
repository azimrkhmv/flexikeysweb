"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Trash } from "lucide-react";
import { Mascot } from "@/components/Mascot";
import { Avatar, Button, Card, Empty, Input, PageHeader, useAction } from "@/components/ui";
import { api, sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

const SUGGESTED = ["parent.ai.q1", "parent.ai.q2", "parent.ai.q3"];

function Assistant() {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const me = sel.me(db);
  const kids = me ? sel.childrenOf(db, me.id) : [];
  const [picked, setPicked] = useState<string | null>(null);
  const childId = picked ?? kids[0]?.id ?? null;
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
  const consent = childId ? sel.hasConsent(db, childId, "ai_processing") : false;

  const send = async (q: string) => {
    if (!childId || !q.trim()) return;
    setText("");
    await ask.run(childId, q.trim(), lang);
  };

  return (
    <>
      <PageHeader title={t("parent.ai.title")} subtitle={t("parent.ai.subtitle")} />
      {kids.length === 0 || !childId ? (
        <Empty />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="flex gap-2 overflow-x-auto lg:flex-col" role="radiogroup" aria-label={t("parent.ai.child")}>
            {kids.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === childId}
                onClick={() => setPicked(c.id)}
                className={`flex shrink-0 items-center gap-3 rounded-2xl p-3 text-left font-bold transition ${c.id === childId ? "bg-surface shadow-soft ring-2 ring-teal" : "hover:bg-surface/70"}`}
              >
                <Avatar emoji={c.avatar} size={40} tone="lavender" /> {c.name}
              </button>
            ))}
          </div>

          <Card className="flex min-h-[60vh] flex-col gap-4">
            <p role="note" className="rounded-2xl bg-sun-soft p-3 text-sm text-[#7a5a0c]">
              {t("ai.disclaimer")}
            </p>

            {!enabled ? (
              <p className="text-ink-2">{t("parent.ai.off")}</p>
            ) : !consent ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <Mascot mood="thinking" size={120} />
                <p className="max-w-md text-ink-2">{t("parent.ai.needConsent")}</p>
                <Button pending={enable.pending} onClick={() => enable.run(childId, "ai_processing", true)}>
                  <Sparkles className="size-4" aria-hidden /> {t("parent.ai.enable")}
                </Button>
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
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <p className={`max-w-[85%] whitespace-pre-line rounded-3xl px-4 py-3 text-[15px] ${m.role === "user" ? "rounded-br-lg bg-primary text-white" : "rounded-bl-lg bg-surface-2 text-ink"}`}>{m.text}</p>
                    </div>
                  ))}
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
        </div>
      )}
    </>
  );
}

// Live mode: not connected to the server yet (PRD Phase 5/6).
export default function Page() {
  return <Assistant />;
}
