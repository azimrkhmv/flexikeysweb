"use client";

import { notify } from "@/components/Toasts";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Trash } from "lucide-react";
import { AppearanceSettings } from "@/components/AppearanceSettings";
import { Button, Card, Field, Input, PageHeader, Select, useAction } from "@/components/ui";
import { Modal } from "@/components/overlays";
import { CloudySwitch } from "@/features/parent/CloudyRoam";
import { askForTour } from "@/features/parent/cloudyStore";
import { api, sel, useDb } from "@/lib/api";
import { normalizePhone } from "@/lib/api/auth";
import { LANGS, useLang, useT, type Lang } from "@/lib/i18n";

export default function Account() {
  const t = useT();
  const [lang, setLang] = useLang();
  const router = useRouter();
  const me = sel.me(useDb());
  const [name, setName] = useState(me?.name ?? "");
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const save = useAction(api.updateMe);
  const del = useAction(api.deleteMe);
  if (!me) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={t("parent.account.title")} />
      <Card>
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if ((await save.run({ name: name.trim() })) !== undefined) notify.ok(t("parent.saved"));
          }}
        >
          <Field label={t("parent.account.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
          </Field>
          <Field label={t("parent.account.phone")}>
            <Input value={me.phone ?? ""} readOnly disabled />
          </Field>
          <Field label={t("parent.account.uiLang")} hint={t("parent.account.uiLangHint")}>
            <Select
              value={lang}
              onChange={(e) => {
                const l = e.target.value as Lang;
                setLang(l);
                save.run({ uiLang: l });
              }}
            >
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {t(`lang.${l}`)}
                </option>
              ))}
            </Select>
          </Field>
          {save.error && <p role="alert" className="text-sm font-semibold text-primary">{save.error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" pending={save.pending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-extrabold">{t("look.appearance")}</h2>
        <p className="text-sm text-muted">{t("look.appearance.hint")}</p>
        <AppearanceSettings />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-extrabold">{t("cloudy.account")}</h2>
        <p className="text-sm text-muted">{t("cloudy.account.hint")}</p>
        <div className="flex flex-wrap gap-3">
          <CloudySwitch />
          <Button variant="outline" size="sm" className="!h-10" onClick={askForTour}>
            {t("cloudy.tour.yes")}
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-extrabold">{t("parent.account.sessions")}</h2>
        <p className="text-sm text-muted">{t("parent.account.sessionsHint")}</p>
        <Button
          variant="outline"
          onClick={async () => {
            await api.logoutAll(); // every device (POST /me/logout-all)
            router.replace("/login");
          }}
        >
          <LogOut className="size-4" aria-hidden /> {t("parent.account.logoutAll")}
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-extrabold">{t("parent.account.delete")}</h2>
        <p className="text-sm text-muted">{t("parent.account.deleteHint")}</p>
        <Button variant="danger" onClick={() => setConfirm(true)}>
          <Trash className="size-4" aria-hidden /> {t("parent.account.delete")}
        </Button>
      </Card>

      <Modal
        open={confirm}
        onClose={() => {
          setConfirm(false);
          setTyped("");
        }}
        title={t("parent.account.deleteTitle")}
      >
        <p className="mb-4 text-muted">{t("parent.account.deleteConfirm")}</p>
        <Field label={t("parent.account.typePhone")}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </Field>
        {del.error && <p role="alert" className="mt-3 text-sm font-semibold text-primary">{del.error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            disabled={!me.phone || normalizePhone(typed) !== me.phone}
            pending={del.pending}
            onClick={async () => {
              if ((await del.run()) !== undefined) router.replace("/");
            }}
          >
            {t("common.delete")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
