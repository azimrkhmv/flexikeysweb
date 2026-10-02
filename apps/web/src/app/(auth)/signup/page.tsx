"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { House, School, Stethoscope, type LucideIcon } from "lucide-react";
import { Button, Checkbox, Field, Input, Select, useAction } from "@/components/ui";
import { AuthTitle, FormError } from "@/features/auth/parts";
import { api } from "@/lib/api";
import { LANG_NAMES, LANGS, useLang, useT, type Lang } from "@/lib/i18n";

type SignupRole = "parent" | "teacher" | "therapist";
const ROLES: [SignupRole, LucideIcon][] = [
  ["parent", House],
  ["teacher", School],
  ["therapist", Stethoscope],
];

export default function SignupPage() {
  const t = useT();
  const router = useRouter();
  const [lang, setLang] = useLang();
  const [role, setRole] = useState<SignupRole>("parent");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const reg = useAction(api.register);

  return (
    <>
      <AuthTitle title={t("auth.signup.title")} lead={t("auth.signup.lead")} />
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!accept) return reg.setError(t("auth.signup.mustAccept"));
          if (await reg.run({ email, password, name, role, uiLang: lang })) router.push("/verify-email");
        }}
      >
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink">{t("auth.signup.role")}</legend>
          <div className="space-y-2">
            {ROLES.map(([r, Icon]) => (
              <label
                key={r}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line p-3 transition hover:bg-surface-2 has-checked:border-teal has-checked:bg-teal-soft/50 has-focus-visible:ring-4 has-focus-visible:ring-primary-soft"
              >
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-ink">{t(`auth.signup.role.${r}`)}</span>
                  <span className="block text-xs text-muted">{t(`auth.signup.role.${r}.d`)}</span>
                </span>
              </label>
            ))}
          </div>
          {role !== "parent" && <p className="mt-2 rounded-2xl bg-sun-soft px-3 py-2 text-xs font-semibold text-[#7a5a0c]">{t("auth.signup.verifyNote")}</p>}
        </fieldset>

        <Field label={t("auth.signup.name")}>
          <Input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("auth.email")}>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t("auth.password")} hint={t("auth.signup.passwordHint")}>
          <Input type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={t("auth.signup.lang")}>
          <Select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_NAMES[l]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="space-y-1.5">
          <Checkbox checked={accept} onChange={setAccept} label={t("auth.signup.accept")} />
          <p className="flex gap-4 px-1 text-xs font-bold">
            <Link href="/terms" target="_blank" className="text-primary hover:underline">{t("nav.terms")}</Link>
            <Link href="/privacy" target="_blank" className="text-primary hover:underline">{t("nav.privacy")}</Link>
          </p>
        </div>

        <FormError>{reg.error}</FormError>
        <Button type="submit" size="lg" className="w-full" pending={reg.pending}>
          {t("auth.signup.submit")}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        {t("auth.signup.haveAccount")}{" "}
        <Link href="/login" className="font-bold text-primary hover:underline">
          {t("auth.signup.login")}
        </Link>
      </p>
    </>
  );
}
