"use client";

import { PageHeader } from "@/components/ui";
import { useT } from "@/lib/i18n";

/** "Exercises" (B100: the menu entry and the heading; the slots come with B106). */
export default function Exercises() {
  const t = useT();
  return <PageHeader title={t("exercises.title")} subtitle={<span className="block max-w-[58ch]">{t("exercises.subtitle")}</span>} />;
}
