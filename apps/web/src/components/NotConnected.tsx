"use client";

import { Cloud } from "lucide-react";
import { useT } from "@/lib/i18n";

/** Live mode: an area the server doesn't support yet (instead of showing mock data as if it were real). */
export function NotConnected() {
  const t = useT();
  return (
    <div role="status" className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-fk-lg border border-line bg-surface p-8 text-center shadow-soft">
      <span className="grid size-14 place-items-center rounded-full bg-sky-soft text-[#2f5d93]">
        <Cloud className="size-7" aria-hidden />
      </span>
      <h2 className="text-xl font-extrabold text-ink">{t("live.notConnected.title")}</h2>
      <p className="text-ink-2">{t("live.notConnected.body")}</p>
    </div>
  );
}
