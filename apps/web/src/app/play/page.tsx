"use client";

import { LiveProvider } from "@/lib/live/client";
import "@/messages/child";
import Link from "next/link";
import { LangSwitch, Logo } from "@/components/brand";
import { Mascot } from "@/components/Mascot";
import { Avatar, buttonClass, LinkButton, Spinner, useAction } from "@/components/ui";
import { ChildMode } from "@/features/play/ChildMode";
import { Target } from "@/features/play/Target";
import { api, sel, useDb } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useMounted } from "@/lib/store";
import { useState } from "react";

/** /play — child mode if a child token exists, otherwise "Who is playing?" for a signed-in parent. */
function PlayPage() {
  const mounted = useMounted();
  const db = useDb();
  const t = useT();
  const start = useAction(api.startChildMode);
  const [blocked, setBlocked] = useState<string | null>(null);
  if (!mounted || sel.loading(db)) return <Spinner />;

  const auth = sel.childAuth(db);
  const child = auth && sel.child(db, auth.childId);
  if (auth && child) return <ChildMode key={child.id} child={child} auth={auth} />;

  const me = sel.me(db);
  const kids = me?.role === "parent" ? sel.childrenOf(db, me.id) : [];

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#eaf3fc_0%,#f7f6f1_70%)]">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 p-4">
        <Logo />
        <div className="flex items-center gap-2">
          <LangSwitch compact />
          {me && (
            <Link href={`/${me.role}`} className={buttonClass("ghost", "sm")}>
              {t("nav.dashboard")}
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 pb-16 pt-6 text-center">
        <Mascot mood="wave" size={180} />
        {me?.role === "parent" ? (
          <>
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{t("play.who")}</h1>
            <p className="text-lg text-ink-2">{kids.length ? t("play.who.sub") : t("play.who.none")}</p>
            <div className="flex flex-wrap justify-center gap-5">
              {kids.map((c) => (
                <Target
                  key={c.id}
                  label={c.name}
                  onSelect={async () => setBlocked((await start.run(c.id)) === undefined ? c.id : null)}
                  className="flex min-w-40 flex-col items-center gap-2 rounded-fk-lg border-4 border-white bg-surface p-5 shadow-soft"
                >
                  <Avatar emoji={c.avatar} size={96} />
                  <span className="text-xl font-extrabold text-ink">{c.name}</span>
                </Target>
              ))}
            </div>
            {start.error && (
              <div role="alert" className="max-w-xl space-y-3 rounded-2xl bg-sun-soft px-4 py-3 text-sm font-semibold text-[#7a5a0c]">
                <p>{start.error}</p>
                {blocked && (
                  <LinkButton href={`/parent/child/${blocked}#privacy`} size="sm" variant="outline">
                    {t("common.openPrivacy")}
                  </LinkButton>
                )}
              </div>
            )}
            {!kids.length && <LinkButton href="/parent/children/new">{t("play.who.add")}</LinkButton>}
          </>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{t("play.signedOut.title")}</h1>
            <div className="flex flex-wrap justify-center gap-3">
              <LinkButton href="/login?next=/play" size="lg">
                {t("play.signedOut.parent")}
              </LinkButton>
              <LinkButton href="/class" variant="soft" size="lg">
                {t("play.signedOut.class")}
              </LinkButton>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <LiveProvider>
      <PlayPage />
    </LiveProvider>
  );
}
