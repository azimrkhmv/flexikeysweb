"use client";

// Client-side registration of the marketing strings (a server-side import never reaches the browser).
import "@/messages/public";
import Link from "next/link";
import { useRef, useState, type MouseEvent } from "react";
import { Menu } from "lucide-react";
import { homeFor, LangSwitch, Logo } from "@/components/brand";
import { buttonClass } from "@/components/ui";
import { useRouteLang, useT } from "@/lib/i18n";
import { useSessionRole } from "@/lib/session";
import { useDismiss } from "@/lib/useDismiss";

const LINKS = [
  { href: "/pricing", key: "nav.pricing" },
  { href: "/#schools", key: "nav.schools" },
  { href: "/#therapists", key: "nav.therapists" },
];

/** Public-page link in the current URL language: "/pricing" → "/ru/pricing", "/#schools" → "/ru#schools". */
export function useLocalePath() {
  const lang = useRouteLang();
  return (path: string) => (!lang ? path : path === "/" ? `/${lang}` : path.startsWith("/#") ? `/${lang}${path.slice(1)}` : `/${lang}${path}`);
}

// Close the mobile <details> menu after picking a link (client navigation keeps it open otherwise).
const closeMenu = (e: MouseEvent<HTMLElement>) => e.currentTarget.closest("details")?.removeAttribute("open");

export function Header() {
  const t = useT();
  const lp = useLocalePath();
  const role = useSessionRole();
  const menu = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useDismiss(menu, summary, menuOpen, () => menu.current?.removeAttribute("open"));
  const account = role ? (
    <Link href={homeFor(role)} className={buttonClass("primary", "sm")}>
      {t("nav.dashboard")}
    </Link>
  ) : (
    <>
      <Link href="/login" className={buttonClass("outline", "sm")}>
        {t("nav.login")}
      </Link>
      <Link href="/signup" className={buttonClass("primary", "sm")}>
        {t("nav.signup")}
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:font-bold">
        {t("mkt.skip")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Logo href={lp("/")} />
        <nav aria-label={t("nav.menu")} className="ml-4 hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={lp(l.href)} className="rounded-full px-3 py-2 text-sm font-bold text-ink-2 hover:bg-surface">
              {t(l.key)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <LangSwitch compact />
          <Link href="/class" className={buttonClass("ghost", "sm")}>
            {t("nav.class")}
          </Link>
          {account}
        </div>
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <LangSwitch compact />
          <details ref={menu} onToggle={(e) => setMenuOpen(e.currentTarget.open)} className="relative">
            <summary ref={summary} className="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-line bg-surface text-ink [&::-webkit-details-marker]:hidden" aria-label={t("nav.menu")}>
              <Menu className="size-5" aria-hidden />
            </summary>
            <div onClick={closeMenu} className="absolute right-0 top-12 flex w-64 flex-col gap-1 rounded-fk border border-line bg-surface p-3 shadow-lift">
              {LINKS.map((l) => (
                <Link key={l.href} href={lp(l.href)} className="rounded-xl px-3 py-2.5 font-bold text-ink-2 hover:bg-surface-2">
                  {t(l.key)}
                </Link>
              ))}
              <Link href="/class" className="rounded-xl px-3 py-2.5 font-bold text-ink-2 hover:bg-surface-2">
                {t("nav.class")}
              </Link>
              <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3 [&>a]:w-full">{account}</div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const t = useT();
  const lp = useLocalePath();
  const col = "space-y-2 text-sm [&_a]:font-semibold [&_a]:text-ink-2 [&_a:hover]:text-primary";
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo href={lp("/")} />
          <p className="max-w-sm text-sm text-ink-2">{t("mkt.footer.about")}</p>
          <p className="text-sm font-semibold text-muted">{t("brand.tagline")}</p>
        </div>
        <div className={col}>
          <h2 className="font-extrabold text-ink">{t("mkt.footer.product")}</h2>
          <ul className="space-y-2">
            <li><Link href={lp("/pricing")}>{t("nav.pricing")}</Link></li>
            <li><Link href={lp("/#schools")}>{t("nav.schools")}</Link></li>
            <li><Link href={lp("/#therapists")}>{t("nav.therapists")}</Link></li>
            <li><Link href="/demo">{t("mkt.hero.demo")}</Link></li>
            <li><Link href="/class">{t("nav.class")}</Link></li>
          </ul>
        </div>
        <div className={col}>
          <h2 className="font-extrabold text-ink">{t("mkt.footer.legal")}</h2>
          <ul className="space-y-2">
            <li><Link href={lp("/privacy")}>{t("nav.privacy")}</Link></li>
            <li><Link href={lp("/terms")}>{t("nav.terms")}</Link></li>
          </ul>
        </div>
        <div className={col}>
          <h2 className="font-extrabold text-ink">{t("nav.language")}</h2>
          <LangSwitch />
        </div>
      </div>
      <p className="border-t border-line px-4 py-6 text-center text-xs text-muted">{t("mkt.footer.rights", { year: new Date().getFullYear() })}</p>
    </footer>
  );
}

/** Shared section heading for marketing pages. */
export function SectionTitle({ id, title, lead, center }: { id?: string; title: string; lead?: string; center?: boolean }) {
  return (
    <div className={`mb-10 max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      <h2 id={id} className="text-3xl font-extrabold text-ink sm:text-4xl">{title}</h2>
      {lead && <p className="mt-3 text-lg text-ink-2">{lead}</p>}
    </div>
  );
}

/** Legal page body built from `${prefix}.intro` and `${prefix}.s{n}.t/.d` keys. */
export function LegalPage({ prefix, sections }: { prefix: string; sections: number }) {
  const t = useT();
  return (
    <article className="mx-auto max-w-3xl px-4 pt-12">
      <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{t(`${prefix}.title`)}</h1>
      <p className="mt-2 text-sm text-muted">{t("mkt.legal.updated")}</p>
      <p className="mt-6 text-lg text-ink-2">{t(`${prefix}.intro`)}</p>
      <div className="mt-10 space-y-4">
        {Array.from({ length: sections }, (_, i) => (
          <section key={i} className="rounded-fk border border-line bg-surface p-6 shadow-soft">
            <h2 className="text-lg font-extrabold text-ink">{t(`${prefix}.s${i + 1}.t`)}</h2>
            <p className="mt-2 leading-relaxed text-ink-2">{t(`${prefix}.s${i + 1}.d`)}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
