"use client";

import "@/messages/adult";
import type { ReactNode } from "react";
import { LangSwitch, Logo } from "@/components/brand";
import { Mascot } from "@/components/Mascot";
import { useT } from "@/lib/i18n";
import { LiveProvider } from "@/lib/live/client";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="min-h-dvh" style={{ background: "linear-gradient(180deg,#eef5fc 0%,#f7f6f1 45%,#eef6ea 100%)" }}>
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Logo />
        <LangSwitch compact />
      </header>
      <main id="main" className="mx-auto w-full max-w-md px-4 pb-16 pt-2">
        <div className="relative z-10 -mb-5 flex items-end justify-center gap-1">
          <div aria-hidden>
            <Mascot mood="calm" size={96} />
          </div>
          <p className="mb-10 rounded-2xl rounded-bl-sm bg-surface px-3 py-2 text-sm font-bold text-ink shadow-soft">{t("auth.bubble")}</p>
        </div>
        <div className="rounded-fk-lg border border-line bg-surface p-6 shadow-lift sm:p-8">
          <LiveProvider>{children}</LiveProvider>
        </div>
      </main>
    </div>
  );
}
