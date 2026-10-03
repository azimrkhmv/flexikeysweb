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

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4">
          <Logo href={`/${me.role}`} small />
          <span className="hidden rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-ink-2 sm:inline">{t(`role.${me.role}`)}</span>
          <div className="ml-auto flex items-center gap-2">
            <LangSwitch compact />
            <Notifications userId={me.id} />
            <span className="hidden text-sm font-bold text-ink md:inline">{me.name}</span>
            <button
              type="button"
              onClick={async () => {
                await api.logout();
                router.replace("/");
              }}
              className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
              aria-label={t("nav.logout")}
              title={t("nav.logout")}
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 pb-28 pt-6 lg:pb-10">
        <nav aria-label={t("nav.menu")} className="sticky top-22 hidden h-fit w-60 shrink-0 lg:block">
          <ul className="space-y-1">
            {nav.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active(href) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-bold transition ${active(href) ? "bg-surface text-primary shadow-soft" : "text-ink-2 hover:bg-surface/70"}`}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1">
          {me.status === "pending_verification" && (
            <div role="status" className="mb-6 rounded-2xl border border-sun bg-sun-soft p-4 text-sm font-semibold text-[#7a5a0c]">
              {t("err.pending_verification")}
            </div>
          )}
          {children}
        </main>
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
