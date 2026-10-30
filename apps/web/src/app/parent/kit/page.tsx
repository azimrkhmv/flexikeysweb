"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { Button, Card, Chip, Field, Input, PageHeader, Select, Textarea, useAction } from "@/components/ui";
import { KIT } from "@/content/kits";
import { districtName, REGIONS, regionById, regionName } from "@/content/districts";
import { fmtDate, fmtSum } from "@/lib/format";
import { api, sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import type { KitDelivery, KitOrder } from "@/lib/types";

// B38 (spec §9): the owner orders the standard Home Kit for a child, by courier or for pickup at a partner centre.
// The material allergy question (P17a) is asked here and must be answered first: our team checks the box before
// sending it. Price and items are placeholders until G3; no money passes here yet.

function Orders({ orders, owner }: { orders: KitOrder[]; owner: boolean }) {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const cancel = useAction(api.cancelKitOrder);
  if (orders.length === 0) return null;
  return (
    <Card className="mb-6 space-y-3">
      <h2 className="font-extrabold text-ink">{t("kit.orders")}</h2>
      <ul className="space-y-2">
        {orders.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {fmtDate(o.createdAt, lang)} · {sel.child(db, o.childId)?.name}
              </span>
              <span className="block text-muted">
                {o.delivery === "courier" ? `${t("kit.courier")} · ${o.address}` : `${t("kit.pickup")} · ${sel.place(db, o.pickupPlaceId ?? "")?.name ?? ""}`}
              </span>
            </span>
            <Chip tone={o.status === "cancelled" ? "gray" : o.status === "delivered" ? "leaf" : "sky"}>{t(`kit.status.${o.status}`)}</Chip>
            {owner && o.status === "placed" && (
              <Button size="sm" variant="ghost" pending={cancel.pending} onClick={() => cancel.run(o.id)}>
                {t("kit.cancel")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {cancel.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{cancel.error}</p>}
    </Card>
  );
}

export default function HomeKit() {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const me = sel.me(db);
  const kids = me ? sel.childrenOf(db, me.id) : [];
  const [child, setChild] = useState<string | null>(null);
  const [allergy, setAllergy] = useState<"yes" | "no" | null>(null);
  const [which, setWhich] = useState("");
  const [delivery, setDelivery] = useState<KitDelivery>("courier");
  const [region, setRegion] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [pickup, setPickup] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const order = useAction(api.orderKit);
  const [done, setDone] = useState(false);
  if (!me) return null;
  const familyId = sel.familyOf(db, me.id);
  const owner = !!familyId && sel.ownFamily(db, me.id) === familyId;
  const childId = child ?? kids[0]?.id;
  const reg = region ?? me.district?.region ?? REGIONS[0].id;
  const dist = district ?? (reg === me.district?.region ? me.district.district : "");
  const centres = sel.places(db, null, me).filter((p) => p.region === reg);
  // The order button stays off until the allergy question is answered ("yes" names the materials).
  const answered = allergy === "no" || (allergy === "yes" && which.trim() !== "");
  const ready = answered && !!childId && !!dist && (delivery === "courier" ? address.trim() !== "" : pickup !== "");

  return (
    <>
      <PageHeader title={t("kit.title")} subtitle={t("kit.subtitle")} />
      <Card className="mb-6 flex flex-wrap items-start gap-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-sun-soft text-[#7a5a00]">
          <Package className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xl font-extrabold">
            {t("kit.box")} · {fmtSum(KIT.priceSom * 100)}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {KIT.items.map((i) => (
              <li key={i}>
                <Chip tone="gray">{t(`tool.${i}`)}</Chip>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t("kit.placeholder")}</p>
        </div>
      </Card>

      <Orders orders={sel.kitOrders(db, familyId)} owner={owner} />

      {!owner ? (
        <Card>
          <p className="text-ink-2">{t("kit.ownerOnly")}</p>
        </Card>
      ) : kids.length === 0 ? null : done ? (
        <Card className="space-y-3">
          <p role="status" className="text-lg font-extrabold text-teal">
            {t("kit.done")}
          </p>
          <Button variant="outline" onClick={() => setDone(false)}>
            {t("kit.again")}
          </Button>
        </Card>
      ) : (
        <Card>
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!ready || !childId || !allergy) return;
              const input = { childId, delivery, region: reg, district: dist, address, pickupPlaceId: pickup || undefined, phone: phone ?? me.phone ?? "", allergy, allergyWhich: which };
              if ((await order.run(input)) !== undefined) setDone(true);
            }}
          >
          {kids.length > 1 && (
            <Field label={t("book.child")}>
              <Select value={childId} onChange={(e) => setChild(e.target.value)}>
                {kids.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <fieldset className="space-y-2">
            <legend className="mb-1 font-bold text-ink">{t("kit.allergy")}</legend>
            <p className="text-sm text-ink-2">{t("kit.allergyHint")}</p>
            <div className="flex flex-wrap gap-4 text-sm">
              {(["no", "yes"] as const).map((a) => (
                <label key={a} className="inline-flex items-center gap-1.5">
                  <input type="radio" name="allergy" checked={allergy === a} onChange={() => setAllergy(a)} /> {t(`kit.allergy.${a}`)}
                </label>
              ))}
            </div>
            {allergy === "yes" && <Textarea maxLength={200} aria-label={t("kit.allergyWhich")} placeholder={t("kit.allergyWhich")} value={which} onChange={(e) => setWhich(e.target.value)} />}
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-bold text-ink">{t("kit.delivery")}</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {(["courier", "pickup"] as const).map((d) => (
                <label key={d} className="inline-flex items-center gap-1.5">
                  <input type="radio" name="delivery" checked={delivery === d} onChange={() => setDelivery(d)} /> {t(`kit.${d}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("kit.region")}>
              <Select value={reg} onChange={(e) => { setRegion(e.target.value); setDistrict(""); setPickup(""); }}>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {regionName(r.id, lang)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("kit.district")}>
              <Select value={dist} onChange={(e) => setDistrict(e.target.value)}>
                <option value="">—</option>
                {regionById(reg)!.districts.map((d) => (
                  <option key={d} value={d}>
                    {districtName(d, lang)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {delivery === "courier" ? (
            <Field label={t("kit.address")}>
              <Input maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
          ) : (
            <Field label={t("kit.centre")}>
              <Select value={pickup} onChange={(e) => setPickup(e.target.value)}>
                <option value="">—</option>
                {centres.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {districtName(p.district, lang)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={t("kit.phone")}>
            <Input type="tel" value={phone ?? me.phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <p className="text-xs text-muted">{t("kit.payNote")}</p>
          <Button type="submit" disabled={!ready} pending={order.pending}>
            {t("kit.order")}
          </Button>
          {!answered && <p className="text-sm text-ink-2">{t("kit.answerFirst")}</p>}
          {order.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{order.error}</p>}
          </form>
        </Card>
      )}
    </>
  );
}
