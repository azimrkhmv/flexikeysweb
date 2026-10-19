"use client";

import { useState } from "react";
import { Button, Card, Chip, Empty, PageHeader, useAction } from "@/components/ui";
import { SectionTitle, Table, td, th, useMe } from "@/features/pro/shared";
import { regionById } from "@/content/districts";
import { KIT_NEXT } from "@/lib/api/kits";
import { fmtDate } from "@/lib/format";
import { api, sel } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

// B39 (spec §9): every Home Kit order, the open ones first. Our team calls the family, then moves the order on:
// placed → confirmed → shipped → delivered, or cancelled before shipping. An order with material allergies is
// confirmed only after the box's materials were checked.

export default function AdminKits() {
  const t = useT();
  const [lang] = useLang();
  const { db } = useMe();
  const move = useAction(api.moveKitOrder);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const orders = sel.admin.kitOrders(db);

  return (
    <>
      <PageHeader title={t("admin.kits.title")} subtitle={t("admin.kits.subtitle")} />
      <Card>
        <SectionTitle>{t("admin.kits.orders")}</SectionTitle>
        {orders.length === 0 ? (
          <Empty />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>{t("admin.kits.ordered")}</th>
                <th className={th}>{t("kit.phone")}</th>
                <th className={th}>{t("kit.delivery")}</th>
                <th className={th}>{t("kit.allergy.short")}</th>
                <th className={th}>{t("admin.kits.status")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className={td}>{fmtDate(o.createdAt, lang, "dayMonth")}</td>
                  <td className={td}>{o.phone}</td>
                  <td className={td}>
                    {t(`kit.${o.delivery}`)}: {[o.address ?? sel.place(db, o.pickupPlaceId ?? "")?.name, o.district, regionById(o.region)?.name].filter(Boolean).join(", ")}
                  </td>
                  <td className={td}>
                    {o.allergy === "yes" ? <Chip tone="sun">{o.allergyWhich}</Chip> : t("kit.allergy.no")}
                    {o.allergy === "yes" && o.status === "placed" && (
                      <label className="mt-1 flex items-center gap-1.5 text-xs">
                        <input type="checkbox" checked={!!checked[o.id]} onChange={(e) => setChecked((x) => ({ ...x, [o.id]: e.target.checked }))} /> {t("admin.kits.checked")}
                      </label>
                    )}
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip tone={o.status === "cancelled" ? "gray" : o.status === "delivered" ? "leaf" : "sky"}>{t(`kit.status.${o.status}`)}</Chip>
                      {(KIT_NEXT[o.status] ?? []).map((s) => (
                        <Button key={s} size="sm" variant={s === "cancelled" ? "ghost" : "outline"} pending={move.pending} onClick={() => move.run(o.id, s, !!checked[o.id])}>
                          {t(`admin.kits.to.${s}`)}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {move.error && <p role="alert" className="mt-2 text-sm font-semibold text-[#8f3a2c]">{move.error}</p>}
      </Card>
    </>
  );
}
