"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input, Modal } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { setReauthPrompt } from "@/lib/live/http";

/** Live admin console: when the server asks for a recent password check (PRD §9.17), ask once and the
 *  change is retried automatically. */
export function ReauthDialog() {
  const t = useT();
  const [resolve, setResolve] = useState<((pw: string | null) => void) | null>(null);
  const [password, setPassword] = useState("");
  useEffect(() => {
    setReauthPrompt(() => new Promise<string | null>((r) => setResolve(() => r)));
    return () => setReauthPrompt(null);
  }, []);
  const close = (value: string | null) => {
    resolve?.(value);
    setResolve(null);
    setPassword("");
  };
  return (
    <Modal open={!!resolve} onClose={() => close(null)} title={t("admin.reauth.title")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (password) close(password);
        }}
      >
        <p className="text-ink-2">{t("admin.reauth.body")}</p>
        <Field label={t("admin.reauth.password")}>
          <Input type="password" autoComplete="current-password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => close(null)}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">{t("admin.reauth.confirm")}</Button>
        </div>
      </form>
    </Modal>
  );
}
