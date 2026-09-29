import { aacCard } from "@/content/aac";
import type { Lang } from "@/lib/i18n";
import type { AacCustomCard, AdaptiveProfile } from "@/lib/types";

// Small, impure-free-in-render helpers for the parent area (dates live here, not in components).

export const AVATARS = ["🦊", "🐰", "🐻", "🐼", "🐯", "🦁", "🐨", "🐸", "🐵", "🦉", "🐧", "🐢", "🦋", "🐳", "🦄", "🐞"];
export const BIRTH_YEARS = Array.from({ length: 11 }, (_, i) => 2024 - i);

export const age = (birthYear: number) => new Date().getFullYear() - birthYear;
export const sinceIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
export const fmtDate = (iso: string, lang: Lang) => new Date(iso).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });

/** 49_000_00 tiyin → "49 000". */
export const fmtSum = (tiyin: number) => Math.round(tiyin / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export function aacLabel(custom: readonly AacCustomCard[], cardId: string, lang: Lang) {
  return aacCard(cardId, lang, custom)?.label ?? cardId;
}

/** Plain-language lines describing the current adaptive profile (observe only). */
export function profileLines(p: AdaptiveProfile, t: (k: string, v?: Record<string, string | number>) => string) {
  const pct = (x: number) => Math.round((x - 1) * 100);
  return [
    pct(p.keyScale) > 0 ? t("parent.profile.keysBigger", { pct: pct(p.keyScale) }) : t("parent.profile.keysStandard"),
    t("parent.profile.spacing", { px: p.spacing }),
    p.dwellMs > 0 ? t("parent.profile.hold", { s: (p.dwellMs / 1000).toFixed(2) }) : t("parent.profile.tap"),
    t(`parent.profile.hint${p.hintLevel}`),
    t("parent.profile.choices", { n: p.optionCount }),
    pct(p.targetScale) > 0 ? t("parent.profile.picturesBigger", { pct: pct(p.targetScale) }) : t("parent.profile.picturesStandard"),
    t("parent.profile.break", { n: p.breakAfterMin }),
  ];
}

export function download(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
