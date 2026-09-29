import { NextResponse, type NextRequest } from "next/server";

// Public pages live under /uz, /ru, /en. The old unprefixed URLs (and every "/" link in the app) redirect to the
// visitor's language: their saved choice (cookie set by the language switcher) > browser Accept-Language > Uzbek.
// Kept self-contained: proxy runs separately from the app bundle (Next 16 docs).
const LANGS = ["uz", "ru", "en"] as const;
type Lang = (typeof LANGS)[number];
const isLang = (x: string | undefined): x is Lang => !!x && (LANGS as readonly string[]).includes(x);

export function pickLang(cookie: string | undefined, acceptLanguage: string | null): Lang {
  if (isLang(cookie)) return cookie;
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.map((r) => r.lang).find(isLang) ?? "uz";
}

export function proxy(request: NextRequest) {
  const lang = pickLang(request.cookies.get("fk_lang")?.value, request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = request.nextUrl.pathname === "/" ? `/${lang}` : `/${lang}${request.nextUrl.pathname}`;
  return NextResponse.redirect(url, 307); // temporary: the target depends on the visitor
}

export const config = { matcher: ["/", "/pricing", "/privacy", "/terms"] };
