"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button, Card, Field, Select } from "@/components/ui";
import { REGIONS, regionName } from "@/content/districts";
import { api, sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { useMounted } from "@/lib/store";

// B113: an account made before the region was asked gets the question once, on its next visit, with "Skip".
// Skipping is remembered on this device; saving stores the region on the account (PATCH /me).

const KEY = "fk-region-asked";
const asked = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
const remember = () => {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* blocked storage: it may ask again next time */
  }
};

export function RegionPrompt() {
  const t = useT();
  const [lang] = useLang();
  const mounted = useMounted();
  const me = sel.me(useDb());
  const [region, setRegion] = useState("");
  const [gone, setGone] = useState(false);
  const [pending, setPending] = useState(false);
  if (!mounted || gone || !me || me.role !== "parent" || me.district?.region || asked()) return null;
  const close = () => {
    remember();
    setGone(true);
  };
  return (
    <Card as="section" className="mb-6 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="size-5 text-primary" aria-hidden />
        <h2 id="region-ask" className="text-lg font-extrabold text-ink">{t("region.ask.title")}</h2>
      </div>
      <p className="text-sm text-muted">{t("region.ask.lead")}</p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!region) return;
          setPending(true);
          try {
            await api.updateMe({ region });
            close();
          } finally {
            setPending(false);
          }
        }}
      >
        <Field label={t("auth.details.region")}>
          <Select required value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="" disabled>{t("auth.details.pick")}</option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>{regionName(r.id, lang)}</option>
            ))}
          </Select>
        </Field>
        <Button type="submit" pending={pending}>{t("region.ask.save")}</Button>
        <Button type="button" variant="ghost" onClick={close}>{t("region.ask.skip")}</Button>
      </form>
    </Card>
  );
}
