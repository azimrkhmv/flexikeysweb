"use client";

import { useState } from "react";
import { AssistantChat } from "@/features/assistant/Chat";
import { Avatar, Empty, PageHeader } from "@/components/ui";
import { sel, useDb } from "@/lib/api";
import { useT } from "@/lib/i18n";

function Assistant() {
  const t = useT();
  const db = useDb();
  const me = sel.me(db);
  const kids = me ? sel.childrenOf(db, me.id) : [];
  const [picked, setPicked] = useState<string | null>(null);
  const childId = picked ?? kids[0]?.id ?? null;

  if (!me) return null;

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

          <AssistantChat childId={childId} />
        </div>
      )}
    </>
  );
}

// Live mode: not connected to the server yet (PRD Phase 5/6).
export default function Page() {
  return <Assistant />;
}
