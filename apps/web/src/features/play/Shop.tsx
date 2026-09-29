"use client";

import { useState } from "react";
import { Mascot } from "@/components/Mascot";
import { SHOP, SHOP_BY_ID, type ShopItem } from "@/content/shop";
import { api, sel, useDb } from "@/lib/api";
import { sfx } from "@/lib/audio";
import { useT } from "@/lib/i18n";
import type { Child } from "@/lib/types";
import { Target } from "./Target";
import { usePlay } from "./context";

const SLOTS: ShopItem["slot"][] = ["hat", "color", "bg"];

/** Cloud shop: cosmetics bought only with coins earned by playing. Tap = try on; buying is a second, explicit tap. */
export function Shop({ child }: { child: Child }) {
  const db = useDb();
  const t = useT(child.uiLang);
  const ctx = usePlay();
  const wallet = sel.wallet(db, child.id);
  const [picked, setPicked] = useState<string | null>(null);
  const item = picked ? SHOP_BY_ID[picked] : null;
  const look = item ? { ...child.equipped, [item.slot]: item.id } : child.equipped;
  const owned = !!item && wallet.owned.includes(item.id);
  const wearing = !!item && child.equipped[item.slot] === item.id;

  const pick = (it: ShopItem) => {
    setPicked(it.id);
    ctx.say(it.name[child.uiLang], child.uiLang);
  };

  const act = async () => {
    if (!item) return;
    try {
      if (wearing) await api.equip(item.slot, null);
      else if (owned) await api.equip(item.slot, item.id);
      else if (wallet.coins >= item.price) {
        await api.redeem(item.id);
        await api.equip(item.slot, item.id);
        sfx("chime");
        ctx.say(t("play.shop.got"), child.uiLang);
      } else ctx.say(t("play.shop.more", { n: item.price - wallet.coins }), child.uiLang);
    } catch {
      /* never show errors to children */
    }
  };

  const action = !item
    ? null
    : wearing
      ? t("play.shop.remove")
      : owned
        ? t("play.shop.wear")
        : wallet.coins >= item.price
          ? t("play.shop.buy", { n: item.price })
          : t("play.shop.more", { n: item.price - wallet.coins });

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[320px_1fr]">
      <section className="flex flex-col items-center gap-3 rounded-fk-lg border-4 border-white p-5 shadow-soft lg:sticky lg:top-4 lg:h-fit" style={{ background: SHOP_BY_ID[look.bg ?? ""]?.value ?? "var(--fk-surface)" }}>
        <div className="flex gap-3 text-lg font-extrabold text-ink">
          <span className="rounded-full bg-surface/90 px-3 py-1">🪙 {t("play.shop.coins", { n: wallet.coins })}</span>
          <span className="rounded-full bg-surface/90 px-3 py-1">⭐ {t("play.shop.stars", { n: wallet.stars })}</span>
        </div>
        <Mascot mood={item ? "happy" : "calm"} size={200} hat={SHOP_BY_ID[look.hat ?? ""]?.emoji} tint={SHOP_BY_ID[look.color ?? ""]?.value} />
        {item && action ? (
          <Target
            label={action}
            onSelect={act}
            className={`w-full rounded-full px-6 text-lg font-extrabold shadow-soft ${owned || wallet.coins >= item.price ? "bg-teal text-white" : "bg-sun-soft text-[#7a5a0c]"}`}
          >
            {action}
          </Target>
        ) : (
          <p className="text-center font-bold text-ink-2">{t("play.shop.pick")}</p>
        )}
      </section>

      <div className="space-y-6">
        {SLOTS.map((slot) => (
          <section key={slot}>
            <h2 className="mb-3 text-xl font-extrabold text-ink">{t(`play.shop.slot.${slot}`)}</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
              {SHOP.filter((s) => s.slot === slot).map((s) => {
                const has = wallet.owned.includes(s.id);
                const on = child.equipped[s.slot] === s.id;
                return (
                  <Target
                    key={s.id}
                    label={s.name[child.uiLang]}
                    selected={picked === s.id}
                    onSelect={() => pick(s)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-3xl border-4 bg-surface/95 p-3 font-bold text-ink shadow-soft ${picked === s.id ? "border-teal" : "border-white"}`}
                  >
                    <span className="text-4xl">{s.emoji}</span>
                    <span className="text-sm">{s.name[child.uiLang]}</span>
                    <span className="text-xs text-ink-2">{on ? "✅" : has ? "💛" : `🪙 ${s.price}`}</span>
                  </Target>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
