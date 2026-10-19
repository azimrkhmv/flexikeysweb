"use client";

import { CalendarDays } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useT } from "@/lib/i18n";

export default function ClinicLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <AppShell role="clinic" nav={[{ href: "/clinic", label: t("clinic.nav"), icon: CalendarDays }]}>
      {() => children}
    </AppShell>
  );
}
