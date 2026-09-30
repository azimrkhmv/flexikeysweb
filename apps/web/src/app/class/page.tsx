"use client";

import "@/messages/child";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { LangSwitch, Logo } from "@/components/brand";
import { Mascot } from "@/components/Mascot";
import { Avatar, Spinner, useErrorText } from "@/components/ui";
import { Target } from "@/features/play/Target";
import { NotConnected } from "@/components/NotConnected";
import { api, LIVE } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { persisted, useMounted, useStore } from "@/lib/store";

type Roster = Awaited<ReturnType<typeof api.classLoginStart>>;

/** Shared classroom devices remember the class so 30 children can log in one after another (FR-TCH-2). */
const classCode = persisted("fk_class_code", "");

export default function ClassPage() {
  // Live mode: class-code login isn't on the server yet (PRD Phase 6).
  if (LIVE)
    return (
      <main className="grid min-h-dvh place-items-center p-4">
        <NotConnected />
      </main>
    );
  return (
    <Suspense fallback={<Spinner />}>
      <ClassLogin />
    </Suspense>
  );
}

function ClassLogin() {
  const t = useT();
  const errText = useErrorText();
  const router = useRouter();
  const mounted = useMounted();
  const saved = useStore(classCode);
  const initial = (useSearchParams().get("code") ?? saved).toUpperCase();
  const [code, setCode] = useState("");
  const [data, setData] = useState<Roster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef("");

  const load = useCallback(
    async (c: string) => {
      tried.current = c;
      try {
        const r = await api.classLoginStart(c);
        classCode.set(c.trim().toUpperCase());
        setData(r);
        setError(null);
      } catch (e) {
        setError(errText(e));
      }
    },
    [errText],
  );

  useEffect(() => {
    if (mounted && initial && !data && tried.current !== initial) void load(initial);
  }, [mounted, initial, data, load]);

  if (!mounted) return <Spinner />;

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#eaf3fc_0%,#f7f6f1_70%)]">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 p-4">
        <Logo />
        <LangSwitch compact />
      </header>
      <main className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 pb-16 pt-4 text-center">
        {!data ? (
          <form
            className="flex w-full max-w-md flex-col items-center gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length >= 6) void load(code);
            }}
          >
            <Mascot mood="wave" size={170} />
            <h1 className="text-3xl font-extrabold text-ink">{t("play.class.title")}</h1>
            <label className="w-full">
              <span className="mb-2 block font-bold text-ink-2">{t("play.class.code")}</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                aria-describedby="class-hint"
                className="h-20 w-full rounded-3xl border-4 border-white bg-surface text-center text-4xl font-extrabold tracking-[0.3em] text-ink shadow-soft focus:border-teal focus:outline-none"
                placeholder="••••••"
              />
            </label>
            <p id="class-hint" className="text-ink-2">{t("play.class.codeHint")}</p>
            {error && (
              <p role="alert" className="font-bold text-[#8f3a2c]">
                {error}
              </p>
            )}
            <button type="submit" disabled={code.length < 6} className="fk-target w-full rounded-full bg-teal text-2xl font-extrabold text-white shadow-soft disabled:opacity-40">
              {t("play.class.go")} ▶
            </button>
          </form>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold text-ink">{data.className}</h1>
            <p className="text-xl text-ink-2">{t("play.class.who")}</p>
            {data.roster.length === 0 && <p className="text-muted">{t("play.class.empty")}</p>}
            <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
              {data.roster.map((c) => (
                <Target
                  key={c.id}
                  label={c.name}
                  onSelect={async () => {
                    await api.classLoginChild(data.classId, c.id);
                    router.push("/play");
                  }}
                  className="flex flex-col items-center gap-2 rounded-fk-lg border-4 border-white bg-surface p-4 shadow-soft"
                >
                  <Avatar emoji={c.avatar} size={88} />
                  <span className="text-xl font-extrabold text-ink">{c.name}</span>
                </Target>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 text-sm font-bold text-ink-2 underline"
              onClick={() => {
                classCode.set("");
                setData(null);
                setCode("");
                tried.current = "";
                router.replace("/class");
              }}
            >
              {t("play.class.change")}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
