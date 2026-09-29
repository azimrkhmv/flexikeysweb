"use client";

import { GraduationCap, KeyRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useT } from "@/lib/i18n";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <AppShell
      role="teacher"
      nav={[
        { href: "/teacher", label: t("teacher.nav.classes"), icon: GraduationCap },
        { href: "/class", label: t("nav.class"), icon: KeyRound },
      ]}
    >
      {() => children}
    </AppShell>
  );
}
