"use client";

import type { ReactNode } from "react";
import { CreditCard, House, ScrollText, Settings, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useT } from "@/lib/i18n";

export default function ParentLayout({ children }: { children: ReactNode }) {
  const t = useT();
  const nav = [
    { href: "/parent", label: t("parent.nav.overview"), icon: House },
    { href: "/parent/reports", label: t("parent.nav.reports"), icon: ScrollText },
    { href: "/parent/assistant", label: t("parent.nav.assistant"), icon: Sparkles },
    { href: "/parent/billing", label: t("parent.nav.billing"), icon: CreditCard },
    { href: "/parent/account", label: t("parent.nav.account"), icon: Settings },
  ];
  return (
    <AppShell role="parent" nav={nav}>
      {() => children}
    </AppShell>
  );
}
