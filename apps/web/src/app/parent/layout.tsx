"use client";

import type { ReactNode } from "react";
import { CalendarCheck, Ellipsis, Gamepad2, HeartPulse, House } from "lucide-react";
import { AppShell, type NavItem } from "@/components/AppShell";
import { Ground, PageFx } from "@/components/Scenery";
import { useMoreNav } from "@/features/parent/nav";
import { useT } from "@/lib/i18n";

export default function ParentLayout({ children }: { children: ReactNode }) {
  const t = useT();
  // Four main entries (spec 2.4); the rest sit behind "More".
  const nav: NavItem[] = [
    { href: "/parent", label: t("parent.nav.overview"), icon: House },
    { href: "/parent/games", label: t("parent.nav.games"), icon: Gamepad2 },
    { href: "/parent/exercises", label: t("nav.exercises"), icon: HeartPulse },
    { href: "/parent/plan", label: t("nav.plan"), icon: CalendarCheck, match: ["/parent/child/"] },
  ];
  const more = { item: { href: "/parent/more", label: t("nav.more"), icon: Ellipsis }, items: useMoreNav() };
  return (
    <AppShell role="parent" nav={nav} more={more} foot={<Ground />}>
      {() => (
        <>
          <PageFx />
          {children}
        </>
      )}
    </AppShell>
  );
}
