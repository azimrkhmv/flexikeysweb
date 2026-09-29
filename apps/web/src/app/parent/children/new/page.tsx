"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { Button, Card, Checkbox, Chip, Field, Input, PageHeader, Select, useAction } from "@/components/ui";
import { AccessPicker, AvatarGrid } from "@/features/parent/pickers";
import { AVATARS, BIRTH_YEARS } from "@/features/parent/lib";
import { api, CONSENT_VERSION, sel, useDb } from "@/lib/api";
import { LANGS, useLang, useT, type Lang } from "@/lib/i18n";
import type { AccessMode, ConsentScope } from "@/lib/types";

const SCOPES: ConsentScope[] = ["core", "ai_processing", "voice_recording", "school_sharing", "therapist_sharing"];

export default function NewChild() {
  const t = useT();
  const [uiLang] = useLang();
  const router = useRouter();
  const me = sel.me(useDb());
  const [step, setStep] = useState(0);
  const [scopes, setScopes] = useState<ConsentScope[]>([]);
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState(2020);
  const [learningLang, setLearningLang] = useState<Lang>(uiLang);
  const [childUi, setChildUi] = useState<Lang>(uiLang);
  const [access, setAccess] = useState<AccessMode>("touch");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const create = useAction(api.createChild);

  const toggle = (s: ConsentScope, on: boolean) => setScopes((xs) => (on ? [...xs, s] : xs.filter((x) => x !== s)));
  const steps = [t("parent.new.step.consent"), t("parent.new.step.profile"), t("parent.new.step.avatar")];

  const submit = async () => {
    const child = await create.run({ name, birthYear, learningLang, uiLang: childUi, avatar, access }, scopes);
    if (child) router.replace(`/parent/child/${child.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/parent" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {t("common.back")}
      </Link>
      <PageHeader title={t("parent.new.title")} subtitle={t("parent.new.subtitle")} />

      <ol className="mb-6 flex gap-2" aria-label={t("parent.new.progress")}>
        {steps.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className="flex flex-1 items-center gap-2">
            <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${i < step ? "bg-teal text-white" : i === step ? "bg-primary text-white" : "bg-surface-2 text-muted"}`}>
              {i < step ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={`truncate text-sm font-bold ${i === step ? "text-ink" : "text-muted"}`}>{label}</span>
          </li>
        ))}
      </ol>

      {me && !me.emailVerified && (
        <div role="status" className="mb-4 rounded-2xl border border-sun bg-sun-soft p-4 text-sm font-semibold text-[#7a5a0c]">
          {t("err.email_not_verified")}{" "}
          <Link href="/verify-email" className="underline">
            {t("parent.home.verifyLink")}
          </Link>
        </div>
      )}

      <Card className="space-y-5">
        {step === 0 && (
          <>
            <div className="flex gap-3 rounded-2xl bg-teal-soft/60 p-4 text-sm text-ink-2">
              <ShieldCheck className="size-6 shrink-0 text-teal" aria-hidden />
              <div className="space-y-2">
                <p className="font-bold text-ink">{t("parent.new.consent.intro")}</p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>{t("parent.new.consent.p1")}</li>
                  <li>{t("parent.new.consent.p2")}</li>
                  <li>{t("parent.new.consent.p3")}</li>
                  <li>{t("parent.new.consent.p4")}</li>
                </ul>
              </div>
            </div>
            <div className="space-y-3">
              {SCOPES.map((s) => (
                <Checkbox
                  key={s}
                  checked={scopes.includes(s)}
                  onChange={(on) => toggle(s, on)}
                  label={
                    <span className="flex flex-wrap items-center gap-2">
                      {t(`consent.${s}`)}
                      <Chip tone={s === "core" ? "peach" : "gray"}>{t(s === "core" ? "parent.new.required" : "parent.new.optional")}</Chip>
                    </span>
                  }
                />
              ))}
            </div>
            <p className="text-xs text-muted">{t("parent.new.consent.version", { v: CONSENT_VERSION })}</p>
            <div className="flex justify-end">
              <Button disabled={!scopes.includes("core")} onClick={() => setStep(1)}>
                {t("parent.new.agree")}
              </Button>
            </div>
          </>
        )}

        {step === 1 && (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) setStep(2);
            }}
          >
            <Field label={t("parent.field.name")} hint={t("parent.field.nameHint")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required autoFocus />
            </Field>
            <Field label={t("parent.field.birthYear")}>
              <Select value={birthYear} onChange={(e) => setBirthYear(Number(e.target.value))}>
                {BIRTH_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("parent.field.learningLang")} hint={t("parent.field.learningLangHint")}>
                <Select value={learningLang} onChange={(e) => setLearningLang(e.target.value as Lang)}>
                  {LANGS.map((l) => (
                    <option key={l} value={l}>
                      {t(`lang.${l}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("parent.field.uiLang")} hint={t("parent.field.uiLangHint")}>
                <Select value={childUi} onChange={(e) => setChildUi(e.target.value as Lang)}>
                  {LANGS.map((l) => (
                    <option key={l} value={l}>
                      {t(`lang.${l}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <AccessPicker value={access} onChange={setAccess} />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                {t("common.back")}
              </Button>
              <Button type="submit" disabled={!name.trim()}>
                {t("common.next")}
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <>
            <fieldset>
              <legend className="mb-3 text-sm font-bold">{t("parent.field.avatar")}</legend>
              <AvatarGrid value={avatar} onChange={setAvatar} />
            </fieldset>
            {create.error && (
              <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">
                {create.error}
              </p>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                {t("common.back")}
              </Button>
              <Button pending={create.pending} onClick={submit}>
                {t("parent.new.create")}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
