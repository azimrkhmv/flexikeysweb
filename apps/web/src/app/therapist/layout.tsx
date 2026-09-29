"use client";

import { Stethoscope } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useT } from "@/lib/i18n";

export default function TherapistLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <AppShell role="therapist" nav={[{ href: "/therapist", label: t("therapist.nav.children"), icon: Stethoscope }]}>
      {() => children}
    </AppShell>
  );
}
