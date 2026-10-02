"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MailCheck } from "lucide-react";
import { homeFor } from "@/components/brand";
import { Button, LinkButton, Spinner, useAction } from "@/components/ui";
import { AuthTitle, FormError, FormNote } from "@/features/auth/parts";
import { api, LIVE, sel, useDb } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useMounted } from "@/lib/store";

export default function VerifyEmailPage() {
  const t = useT();
  const router = useRouter();
  const mounted = useMounted();
  const db = useDb();
  const me = mounted ? sel.me(db) : null;
  const [resent, setResent] = useState(false);
  const verify = useAction(api.verifyEmail);
  const resend = useAction(api.resendVerification);
  // Live: the emailed link lands here with ?token=… — confirm it once, automatically.
  const tried = useRef(false);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!LIVE || !token || !me || me.emailVerified || tried.current) return;
    tried.current = true;
    void verify.run(token);
  });

  if (!mounted) return <Spinner />;
  if (!me)
    return (
      <>
        <AuthTitle title={t("auth.verify.title")} lead={t("auth.verify.signedOut")} />
        <LinkButton href="/login?next=/verify-email" className="w-full">{t("nav.login")}</LinkButton>
      </>
    );

  const next = me.role === "parent" ? "/parent/children/new" : homeFor(me.role);

  if (me.emailVerified)
    return (
      <>
        <AuthTitle title={t("auth.verify.done")} />
        <LinkButton href={next} size="lg" className="w-full">{t("auth.verify.continue")}</LinkButton>
      </>
    );

  return (
    <>
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-sky-soft text-[#2f5d93]">
        <MailCheck className="size-7" aria-hidden />
      </span>
      <AuthTitle title={t("auth.verify.title")} lead={t("auth.verify.lead", { email: me.email })} />
      <div className="space-y-3">
        {!LIVE && <p className="rounded-2xl bg-sun-soft px-4 py-3 text-sm font-semibold text-[#7a5a0c]">{t("auth.verify.demo")}</p>}
        <FormError>{verify.error}</FormError>
        {!LIVE && (
        <Button
          size="lg"
          className="w-full"
          pending={verify.pending}
          onClick={async () => {
            if (await verify.run()) router.push(next);
          }}
        >
          {t("auth.verify.demoButton")}
        </Button>
        )}
        <Button variant="ghost" className="w-full" pending={resend.pending} onClick={async () => setResent((await resend.run()) === true)}>
          {t("auth.verify.resend")}
        </Button>
        <FormError>{resend.error}</FormError>
        {resent && <FormNote>{t("auth.verify.resent")}</FormNote>}
      </div>
    </>
  );
}
