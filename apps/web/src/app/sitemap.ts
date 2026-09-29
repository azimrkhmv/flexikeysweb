import type { MetadataRoute } from "next";
import { localized, MARKETING_PATHS, SITE_URL } from "@/features/marketing/seo";
import { LANGS } from "@/lib/translate";

// Every public page in every language, each listing its translations (hreflang) — PRD §9.19.
export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_PATHS.flatMap((path) =>
    LANGS.map((lang) => ({
      url: SITE_URL + localized(lang, path),
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.6,
      alternates: { languages: Object.fromEntries(LANGS.map((l) => [l, SITE_URL + localized(l, path)])) },
    })),
  );
}
