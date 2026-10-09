"use client";

import { Clapperboard } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useT } from "@/lib/i18n";

export default function PhysioLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <AppShell role={["physio", "admin"]} nav={[{ href: "/physio", label: t("review.nav"), icon: Clapperboard }]}>
      {() => children}
    </AppShell>
  );
}
