"use client";

import type { ReactNode } from "react";
import type { MascotMood } from "@/lib/types";
import { Logo } from "./brand";
import { Mascot } from "./Mascot";

/** Full-page state (404, crash) in the brand voice: mascot, one heading, one sentence, clear next steps. */
export function StatusPage({ mood, title, body, children }: { mood: MascotMood; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[linear-gradient(180deg,#eef5fc_0%,#f7f6f1_60%)]">
      <header className="mx-auto w-full max-w-5xl p-4">
        <Logo />
      </header>
      <main id="main" className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-5 px-4 pb-16 text-center">
        <Mascot mood={mood} size={180} />
        <h1 className="text-3xl font-extrabold text-ink">{title}</h1>
        {body && <p className="text-lg text-ink-2">{body}</p>}
        <div className="flex flex-wrap justify-center gap-3">{children}</div>
      </main>
    </div>
  );
}
