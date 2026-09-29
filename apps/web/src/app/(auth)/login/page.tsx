"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { homeFor } from "@/components/brand";
import { Button, Field, Input, useAction } from "@/components/ui";
import { AuthTitle, FormError, GoogleMark } from "@/features/auth/parts";
import { api, DEMO_PASSWORD } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Role, User } from "@/lib/types";

const DEMOS: [Role, string][] = [
  ["parent", "parent@demo.uz"],
  ["teacher", "teacher@demo.uz"],
  ["therapist", "therapist@demo.uz"],
  ["admin", "admin@demo.uz"],
];

/** Only same-site relative paths — never "//host" or "/\host" (open redirect). */
const safeNext = (next: string | null) => (next && /^\/(?![/\\])/.test(next) ? next : null);

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useAction(api.login);
  const google = useAction(api.loginWithGoogle);

  const go = (u: User | undefined) => {
    if (!u) return;
    router.replace(safeNext(new URLSearchParams(window.location.search).get("next")) ?? homeFor(u.role));
  };
  const busy = login.pending || google.pending;

  return (
    <>
      <AuthTitle title={t("auth.login.title")} lead={t("auth.login.lead")} />
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          go(await login.run(email, password));
        }}
      >
        <Field label={t("auth.email")}>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t("auth.password")}>
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="-mt-1 text-right">
          <Link href="/forgot-password" className="text-sm font-bold text-primary hover:underline">
            {t("auth.login.forgot")}
          </Link>
        </div>
        <FormError>{login.error ?? google.error}</FormError>
        <Button type="submit" size="lg" className="w-full" pending={login.pending} disabled={busy}>
          {t("auth.login.submit")}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase text-muted">
        <span className="h-px flex-1 bg-line" /> {t("auth.or")} <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="outline" size="lg" className="w-full" pending={google.pending} disabled={busy} onClick={async () => go(await google.run())}>
        <GoogleMark /> {t("auth.google")}
      </Button>

      <p className="mt-6 text-center text-sm text-ink-2">
        {t("auth.login.noAccount")}{" "}
        <Link href="/signup" className="font-bold text-primary hover:underline">
          {t("auth.login.signup")}
        </Link>
      </p>

      <section aria-labelledby="demo-title" className="mt-8 rounded-fk bg-surface-2 p-4">
        <h2 id="demo-title" className="font-extrabold text-ink">{t("auth.demo.title")}</h2>
        <p className="mt-1 text-xs text-muted">{t("auth.demo.hint", { pw: DEMO_PASSWORD })}</p>
        <ul className="mt-3 space-y-2">
          {DEMOS.map(([role, demoEmail]) => (
            <li key={role} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-3 py-2">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{t(`role.${role}`)}</span>
                <span className="block truncate text-xs text-muted">{demoEmail}</span>
              </span>
              <Button
                size="sm"
                variant="soft"
                disabled={busy}
                aria-label={`${t("auth.demo.use")}: ${t(`role.${role}`)}`}
                onClick={async () => {
                  setEmail(demoEmail);
                  setPassword(DEMO_PASSWORD);
                  go(await login.run(demoEmail, DEMO_PASSWORD));
                }}
              >
                {t("auth.demo.use")}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
