"use client";

import { CreditCard, MapPin, Package, ScrollText, Settings, Sparkles } from "lucide-react";
import type { NavItem } from "@/components/AppShell";
import { useT } from "@/lib/i18n";

/** The pages behind "More" (B100): nothing is removed, only the menu is shorter. Also listed on /parent/more. */
export function useMoreNav(): NavItem[] {
  const t = useT();
  return [
    { href: "/parent/reports", label: t("parent.nav.reports"), icon: ScrollText },
    { href: "/parent/help", label: t("parent.nav.help"), icon: MapPin },
    { href: "/parent/kit", label: t("parent.nav.kit"), icon: Package },
    { href: "/parent/assistant", label: t("parent.nav.assistant"), icon: Sparkles },
    { href: "/parent/billing", label: t("parent.nav.billing"), icon: CreditCard },
    { href: "/parent/account", label: t("parent.nav.account"), icon: Settings },
  ];
}
