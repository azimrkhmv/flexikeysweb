"use client";

import { ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { ExerciseVideo } from "@/lib/types";
import type { Lang } from "@/lib/i18n";

// B115 (Update 4 spec 6): an exercise a specialist signed off (its video approved by a physiotherapist in this
// language, product rule 3) says so in one small line.

export const isChecked = (video: ExerciseVideo, lang: Lang) => video.versions[lang]?.status === "approved";

export function CheckedBySpecialist() {
  const t = useT();
  return (
    <p className="flex items-center gap-1 text-xs font-bold text-primary">
      <ShieldCheck className="size-4" aria-hidden /> {t("exercise.checked")}
    </p>
  );
}
