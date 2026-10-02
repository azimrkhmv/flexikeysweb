"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Field, Input, LinkButton, useAction } from "@/components/ui";
import { AuthTitle, FormError, FormNote } from "@/features/auth/parts";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

// The emailed link lands here with ?token=… (single use, 15 minutes — FR-AUTH-3).
export default function ResetPasswordPage() {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);
  const reset = useAction(api.resetPassword);

  return (
    <>
      <AuthTitle title={t("auth.reset.title")} lead={t("auth.reset.lead")} />
      {done ? (
        <div className="space-y-4">
          <FormNote>{t("auth.reset.done")}</FormNote>
          <LinkButton href="/login" size="lg" className="w-full">
            {t("nav.login")}
          </LinkButton>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setMismatch(password !== confirm);
            if (password !== confirm) return;
            const token = new URLSearchParams(window.location.search).get("token") ?? "";
            if (await reset.run(token, password)) setDone(true);
          }}
        >
          <Field label={t("auth.reset.password")}>
            <Input type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label={t("auth.reset.confirm")}>
            <Input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <FormError>{mismatch ? t("auth.reset.mismatch") : reset.error}</FormError>
          {(reset.error === t("err.token_used") || reset.error === t("err.token_expired") || reset.error === t("err.invalid_token")) && (
            <Link href="/forgot-password" className="block text-sm font-bold text-primary hover:underline">
              {t("auth.login.forgot")}
            </Link>
          )}
          <Button type="submit" size="lg" className="w-full" pending={reset.pending}>
            {t("auth.reset.submit")}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-bold text-primary hover:underline">
          {t("auth.back")}
        </Link>
      </p>
    </>
  );
}
