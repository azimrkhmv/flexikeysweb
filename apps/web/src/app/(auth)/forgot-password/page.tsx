"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Field, Input, useAction } from "@/components/ui";
import { AuthTitle, FormError, FormNote } from "@/features/auth/parts";
import { NotConnected } from "@/components/NotConnected";
import { api, LIVE } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  // Live: the server can't send email yet (its mail transport is a stub), so a reset link would never arrive.
  return LIVE ? <NotConnected /> : <ForgotPassword />;
}

function ForgotPassword() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const forgot = useAction(api.forgotPassword);

  return (
    <>
      <AuthTitle title={t("auth.forgot.title")} lead={t("auth.forgot.lead")} />
      {sent ? (
        <FormNote>{t("auth.forgot.sent")}</FormNote>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await forgot.run(email)) setSent(true);
          }}
        >
          <Field label={t("auth.email")}>
            <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <FormError>{forgot.error}</FormError>
          <Button type="submit" size="lg" className="w-full" pending={forgot.pending}>
            {t("auth.forgot.submit")}
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
