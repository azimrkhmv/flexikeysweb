import type { Metadata } from "next";
import "@/messages/public";
import { LANGS, translate, type Lang } from "@/lib/translate";

export { SITE_URL } from "@/lib/site";

// Server-side SEO for the public pages: localized title/description, canonical URL, hreflang alternates, Open Graph.

/** Public pages that exist in every language (path after the /uz|/ru|/en prefix). */
export const MARKETING_PATHS = ["", "/pricing", "/privacy", "/terms"] as const;

const OG_LOCALE: Record<Lang, string> = { uz: "uz_UZ", ru: "ru_RU", en: "en_US" };

export const localized = (lang: Lang, path: string) => `/${lang}${path}`;

export function marketingMetadata(lang: Lang, path: string, keys: { title?: string; description: string }): Metadata {
  const title = keys.title ? translate(lang, keys.title) : `FlexiKeys — ${translate(lang, "brand.tagline")}`;
  const description = translate(lang, keys.description);
  return {
    title: keys.title ? title : { absolute: title },
    description,
    alternates: {
      canonical: localized(lang, path),
      languages: { ...Object.fromEntries(LANGS.map((l) => [l, localized(l, path)])), "x-default": localized("uz", path) },
    },
    openGraph: {
      type: "website",
      siteName: "FlexiKeys",
      title,
      description,
      url: localized(lang, path),
      locale: OG_LOCALE[lang],
      alternateLocale: LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
    },
  };
}
