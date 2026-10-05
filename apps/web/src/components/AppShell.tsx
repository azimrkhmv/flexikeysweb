"use client";

import "@/messages/adult";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, LogOut, type LucideIcon } from "lucide-react";
import { api, LIVE, sel, useDb } from "@/lib/api";
import { LiveProvider } from "@/lib/live/client";
import { useLang, useT } from "@/lib/i18n";
import { useMounted } from "@/lib/store";
import { useDismiss } from "@/lib/useDismiss";
import type { Role, User } from "@/lib/types";
import { homeFor, LangSwitch, Logo } from "./brand";
import { ReauthDialog } from "./ReauthDialog";
import { Spinner } from "./ui";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Client-side role gate for dashboard areas. UX only — the API enforces real authorization.
 * Renders children with the signed-in user once hydrated.
 * While a child session is active, adult areas send you back to child mode: the only way out is the
 * parent gate, which ends the child session (FR-PLAY-3 — Back button / typed URL can't skip it).
 */
export function RequireRole({ role, children }: { role: Role | Role[]; children: (me: User) => ReactNode }) {
  const mounted = useMounted();
  const db = useDb();
  const me = sel.me(db);
  const childMode = !!sel.childAuth(db);
  const router = useRouter();
  const path = usePathname();
  const roles = Array.isArray(role) ? role : [role];
  const ok = !!me && roles.includes(me.role) && me.status !== "disabled";

  useEffect(() => {
    if (!mounted || sel.loading(db)) return; // live mode: wait for the server before deciding
    if (childMode) router.replace("/play");
    else if (!me) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (!roles.includes(me.role)) router.replace(homeFor(me.role));
  });

  if (!mounted || sel.loading(db) || !ok || childMode) return <Spinner />;
  return <>{children(me)}</>;
}

export function AppShell({ role, nav, children }: { role: Role; nav: NavItem[]; children: (me: User) => ReactNode }) {
  return (
    <LiveProvider>
      <RequireRole role={role}>
        {(me) => (
          <Shell me={me} nav={nav}>
            {/* Live mode connects the parent area first; other dashboards come in later phases. */}
            {children(me)}
            {LIVE && role === "admin" && <ReauthDialog />}
          </Shell>
        )}
      </RequireRole>
    </LiveProvider>
  );
}

function Shell({ me, nav, children }: { me: User; nav: NavItem[]; children: ReactNode }) {
  const t = useT();
  const [lang] = useLang();
  // The language picked on this device is the user's preference: keep the account in sync (PATCH /users/me).
  useEffect(() => {
    if (me.uiLang !== lang) api.updateMe({ uiLang: lang }).catch(() => {});
  }, [me.uiLang, lang]);
  const path = usePathname();
  const router = useRouter();
  const active = (href: string) => (href === `/${me.role}` ? path === href : path.startsWith(href));

  const logout = async () => {
    await api.logout();
    router.replace("/");
  };
  const initial = me.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto flex max-w-[1440px] gap-6 px-4 pb-28 lg:px-6 lg:pb-8">
        {/* Desktop: the menu is one full-height panel — brand on top, the signed-in person at the bottom. */}
        <aside className="sticky top-6 mt-6 hidden h-[calc(100dvh-3rem)] print:!hidden w-64 shrink-0 flex-col rounded-fk-lg border border-line bg-surface p-4 shadow-soft lg:flex">
          <div className="flex items-center gap-2 px-2 pb-6 pt-1">
            <Logo href={`/${me.role}`} small />
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-ink-2">{t(`role.${me.role}`)}</span>
          </div>
          <nav aria-label={t("nav.menu")} className="min-h-0 flex-1 overflow-y-auto">
            <ul className="space-y-1">
              {nav.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active(href) ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 font-bold transition ${active(href) ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-surface-2"}`}
                  >
                    <Icon className="size-5" aria-hidden />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold text-white" aria-hidden>
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold text-ink">{me.name}</span>
              <span className="block truncate text-xs text-muted">{t(`role.${me.role}`)}</span>
            </span>
            <button type="button" onClick={logout} className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-surface" aria-label={t("nav.logout")} title={t("nav.logout")}>
              <LogOut className="size-5" />
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Top bar: brand + sign-out only on small screens (the panel holds them on desktop). */}
          <header className="sticky top-0 z-30 -mx-4 flex h-16 items-center gap-3 bg-bg/90 px-4 backdrop-blur lg:static lg:mx-0 lg:mt-6 lg:h-12 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
            <div className="flex items-center gap-2 lg:hidden">
              <Logo href={`/${me.role}`} small />
              <span className="hidden rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-ink-2 sm:inline">{t(`role.${me.role}`)}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <LangSwitch compact />
              <Notifications userId={me.id} />
              <button type="button" onClick={logout} className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface-2 lg:hidden" aria-label={t("nav.logout")} title={t("nav.logout")}>
                <LogOut className="size-5" />
              </button>
            </div>
          </header>
          <main className="pt-2 lg:pt-4">
            {me.status === "pending_verification" && (
              <div role="status" className="mb-6 rounded-2xl border border-sun bg-sun-soft p-4 text-sm font-semibold text-[#7a5a0c]">
                {t("err.pending_verification")}
              </div>
            )}
            {children}
          </main>
        </div>
      </div>

      <nav aria-label={t("nav.menu")} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="flex overflow-x-auto">
          {nav.map(({ href, label, icon: Icon }) => (
            <li key={href} className="min-w-[76px] flex-1">
              <Link
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-bold ${active(href) ? "text-primary" : "text-muted"}`}
              >
                <Icon className="size-5" aria-hidden />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Notifications({ userId }: { userId: string }) {
  const t = useT();
  const db = useDb();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useDismiss(root, trigger, open, () => setOpen(false));
  const list = sel.notifications(db, userId);
  const unread = list.filter((n) => !n.read).length;
  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${t("nav.notifications")} (${unread})`}
        className="relative grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
      >
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-teal px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-[min(340px,calc(100vw-32px))] rounded-fk border border-line bg-surface p-2 shadow-lift">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="font-extrabold">{t("nav.notifications")}</span>
            {unread > 0 && (
              <button type="button" className="text-xs font-bold text-primary" onClick={() => api.markRead()}>
                {t("common.markAllRead")}
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {list.length === 0 && <li className="px-3 py-4 text-sm text-muted">{t("common.none")}</li>}
            {list.slice(0, 10).map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => api.markRead(n.id)} className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-line" : "bg-teal"}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{t(n.titleKey, n.vars)}</span>
                    <span className="block text-xs text-muted">{new Date(n.at).toLocaleString()}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
