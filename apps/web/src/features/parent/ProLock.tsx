"use client";

import { Sparkles } from "lucide-react";
import { Card, LinkButton } from "@/components/ui";
import { useT } from "@/lib/i18n";

/** Something Free does not include (A7.2, spec §14): what Pro adds, and the way to the plan page. Parents only. */
export function ProLock({ text }: { text: string }) {
  const t = useT();
  return (
    <Card className="flex flex-wrap items-center gap-3 border-lavender bg-lavender-soft/50 p-4">
      <Sparkles className="size-5 shrink-0 text-[#4f43a0]" aria-hidden />
      <p className="min-w-0 flex-1 text-sm font-semibold text-ink">{text}</p>
      <LinkButton href="/parent/billing" size="sm" variant="soft">
        {t("plans.lock.see")}
      </LinkButton>
    </Card>
  );
}
