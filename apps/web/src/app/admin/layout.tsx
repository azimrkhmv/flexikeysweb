"use client";

import { Activity, BookOpen, Clapperboard, CreditCard, MessageSquare, Package, ScrollText, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useT } from "@/lib/i18n";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <AppShell
      role="admin"
      nav={[
        { href: "/admin", label: t("admin.nav.overview"), icon: Activity },
        { href: "/admin/users", label: t("admin.nav.users"), icon: Users },
        { href: "/admin/billing", label: t("admin.nav.billing"), icon: CreditCard },
        { href: "/admin/kits", label: t("admin.nav.kits"), icon: Package },
        { href: "/admin/content", label: t("admin.nav.content"), icon: BookOpen },
        { href: "/admin/audit", label: t("admin.nav.audit"), icon: ScrollText },
        { href: "/admin/feedback", label: t("admin.nav.feedback"), icon: MessageSquare },
        { href: "/physio", label: t("review.nav"), icon: Clapperboard },
      ]}
    >
      {() => children}
    </AppShell>
  );
}
