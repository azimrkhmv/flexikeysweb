"use client";

import "@/messages/child";
import { useEffect } from "react";
import { Mascot } from "@/components/Mascot";
import { Target } from "@/features/play/Target";
import { useT } from "@/lib/i18n";

// Child mode never shows an error message (PRD §26): a calm mascot and one big way back.
export default function PlayError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  useEffect(() => console.error("[child-mode]", error.digest ?? error), [error]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[linear-gradient(180deg,#eaf3fc_0%,#f5f9f0_60%,#e3f0dc_100%)] p-4">
      <Mascot mood="calm" size={200} />
      <Target label={t("play.oops")} onSelect={() => retry()} className="rounded-full bg-teal px-8 text-xl font-extrabold text-white shadow-soft">
        🗺️ {t("play.oops")}
      </Target>
    </main>
  );
}
