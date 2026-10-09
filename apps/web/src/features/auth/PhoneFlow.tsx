"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { homeFor } from "@/components/brand";
import { Button, Checkbox, Field, Input, Select, useAction } from "@/components/ui";
import { REGIONS, regionById } from "@/content/districts";
import { AuthTitle, FormError, FormNote } from "@/features/auth/parts";
import { api, DEMO_PHONES, sel, useDb } from "@/lib/api";
import { applyAccountLang, LANG_NAMES, UI_LANGS, useLangChosen, useT, useUiLang } from "@/lib/i18n";
import { useMounted } from "@/lib/store";
import type { User } from "@/lib/types";

// Spec §4: language first, then phone + SMS code (no passwords), then basic consent with city and district.

type Step = "lang" | "phone" | "code" | "details";

/** Only same-site relative paths — never "//host" or "/\host" (open redirect). */
export const safeNext = (next: string | null) => (next && /^\/(?![/\\])/.test(next) ? next : null);

const DEMOS = [
  ["parent", DEMO_PHONES.parent],
  ["therapist", DEMO_PHONES.therapist],
  ["physio", DEMO_PHONES.physio],
  ["admin", DEMO_PHONES.admin],
] as const;

export function PhoneFlow({ showDemos }: { showDemos?: boolean }) {
  const t = useT();
  const router = useRouter();
  const db = useDb();
  const me = sel.me(db);
  const chosen = useLangChosen();
  const [lang, setLang] = useUiLang();
  const mounted = useMounted();
  // Derived until the person moves on, so the saved language (read after hydration) decides the first screen.
  const [picked, setStep] = useState<Step | null>(null);
  const step: Step = picked ?? (me?.phone && !me.consentVersion ? "details" : chosen ? "phone" : "lang");
  const [phone, setPhone] = useState("+998 ");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const send = useAction(api.requestCode);
  const verify = useAction(api.verifyCode);

  useEffect(() => {
    if (step !== "code") return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    // Android Chrome reads the code from the SMS (WebOTP); the input's autocomplete covers iOS.
    const ac = new AbortController();
    if ("OTPCredential" in window)
      navigator.credentials
        .get({ otp: { transport: ["sms"] }, signal: ac.signal } as CredentialRequestOptions)
        .then((c) => c && setCode((c as unknown as { code: string }).code))
        .catch(() => {});
    return () => {
      clearInterval(iv);
      ac.abort();
    };
  }, [step]);

  const go = (u: User) => {
    applyAccountLang(u.uiLang);
    if (u.phone && !u.consentVersion) return setStep("details");
    router.replace(safeNext(new URLSearchParams(window.location.search).get("next")) ?? homeFor(u.role));
  };
  const requestCode = async (p = phone) => {
    const r = await send.run(p);
    if (!r) return false;
    setDemoCode(r.demoCode);
    setResendAt(Date.now() + r.resendAfterMs);
    setNow(Date.now());
    setStep("code");
    return r;
  };
  const busy = send.pending || verify.pending;

  if (!mounted) return null;
  if (step === "lang")
    return (
      <>
        <AuthTitle title={t("auth.phone.langTitle")} />
        <div className="grid gap-3">
          {UI_LANGS.map((l) => (
            <Button
              key={l}
              size="lg"
              variant={l === lang ? "primary" : "outline"}
              className="w-full"
              lang={l === "uz_cyrl" ? "uz-Cyrl" : l}
              onClick={() => {
                setLang(l);
                setStep("phone");
              }}
            >
              {LANG_NAMES[l]}
            </Button>
          ))}
        </div>
      </>
    );

  if (step === "details") return <Details />;

  return (
    <>
      <AuthTitle title={t("auth.phone.title")} lead={t("auth.phone.lead")} />
      {step === "phone" ? (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await requestCode();
          }}
        >
          <Field label={t("auth.phone.number")}>
            <Input type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <FormError>{send.error}</FormError>
          <Button type="submit" size="lg" className="w-full" pending={send.pending}>
            {t("auth.phone.send")}
          </Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await verify.run(phone, code, lang);
            if (r) go(r.user);
          }}
        >
          <p className="text-sm text-ink-2">{t("auth.phone.sentTo", { phone })}</p>
          {demoCode && <FormNote>{t("auth.phone.demoCode", { code: demoCode })}</FormNote>}
          <Field label={t("auth.phone.code")}>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <FormError>{verify.error ?? send.error}</FormError>
          <Button type="submit" size="lg" className="w-full" pending={verify.pending} disabled={busy}>
            {t("auth.phone.verify")}
          </Button>
          <div className="flex items-center justify-between text-sm font-bold">
            <button type="button" className="text-primary hover:underline" onClick={() => setStep("phone")}>
              {t("auth.phone.change")}
            </button>
            {now < resendAt ? (
              <span className="text-muted">{t("auth.phone.resendIn", { s: Math.ceil((resendAt - now) / 1000) })}</span>
            ) : (
              <button type="button" className="text-primary hover:underline" disabled={busy} onClick={() => requestCode()}>
                {t("auth.phone.resend")}
              </button>
            )}
          </div>
        </form>
      )}

      {showDemos && step === "phone" && (
        <section aria-labelledby="demo-title" className="mt-8 rounded-fk bg-surface-2 p-4">
          <h2 id="demo-title" className="font-extrabold text-ink">{t("auth.demo.title")}</h2>
          <p className="mt-1 text-xs text-muted">{t("auth.phone.demoHint")}</p>
          <ul className="mt-3 space-y-2">
            {DEMOS.map(([role, demoPhone]) => (
              <li key={role} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">{t(`role.${role}`)}</span>
                  <span className="block truncate text-xs text-muted">{demoPhone}</span>
                </span>
                <Button
                  size="sm"
                  variant="soft"
                  disabled={busy}
                  aria-label={`${t("auth.demo.use")}: ${t(`role.${role}`)}`}
                  onClick={async () => {
                    setPhone(demoPhone);
                    const r = await send.run(demoPhone).catch(() => undefined);
                    const v = r && (await verify.run(demoPhone, r.demoCode, lang));
                    if (v) go(v.user);
                  }}
                >
                  {t("auth.demo.use")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Basic consent + city and district (both required, spec §4). */
function Details() {
  const t = useT();
  const router = useRouter();
  const [region, setRegion] = useState(REGIONS[0].id);
  const [district, setDistrict] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const save = useAction(api.completeSignup);
  return (
    <>
      <AuthTitle title={t("auth.details.title")} lead={t("auth.details.lead")} />
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!consent) return save.setError(t("auth.details.mustConsent"));
          if (await save.run({ name, region, district, consent })) router.replace("/parent/children/new");
        }}
      >
        <Field label={t("auth.details.name")}>
          <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("auth.details.region")}>
          <Select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setDistrict("");
            }}
          >
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("auth.details.district")}>
          <Select required value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="" disabled>
              {t("auth.details.pick")}
            </option>
            {regionById(region)!.districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <div className="space-y-1.5">
          <Checkbox checked={consent} onChange={setConsent} label={t("auth.details.consent")} description={t("auth.details.consent.d")} />
          <p className="flex gap-4 px-1 text-xs font-bold">
            <Link href="/terms" target="_blank" className="text-primary hover:underline">{t("nav.terms")}</Link>
            <Link href="/privacy" target="_blank" className="text-primary hover:underline">{t("nav.privacy")}</Link>
          </p>
        </div>
        <FormError>{save.error}</FormError>
        <Button type="submit" size="lg" className="w-full" pending={save.pending}>
          {t("auth.details.submit")}
        </Button>
      </form>
    </>
  );
}
