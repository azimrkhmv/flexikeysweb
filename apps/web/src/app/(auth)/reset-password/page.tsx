"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { AuthTitle, FormError, FormNote } from "@/features/auth/parts";
import { NotConnected } from "@/components/NotConnected";
import { LIVE } from "@/lib/api";
import { useT } from "@/lib/i18n";

// ponytail: mock form — the real page posts the single-use token from the email link to POST /auth/reset-password.
export default function ResetPasswordPage() {
  return LIVE ? <NotConnected /> : <ResetPassword />; // live: no reset emails yet (see forgot-password)
}

function ResetPassword() {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <>
      <AuthTitle title={t("auth.reset.title")} lead={t("auth.reset.lead")} />
      {done ? (
        <FormNote>{t("auth.reset.done")}</FormNote>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (password.length < 10) return setError(t("err.weak_password"));
            if (password !== confirm) return setError(t("auth.reset.mismatch"));
            setError(null);
            setDone(true);
          }}
        >
          <Field label={t("auth.reset.password")}>
            <Input type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label={t("auth.reset.confirm")}>
            <Input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <FormError>{error}</FormError>
          <Button type="submit" size="lg" className="w-full">
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
