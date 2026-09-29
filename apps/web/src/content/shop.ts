import type { L10n } from "@/lib/types";

// Cloud shop: cosmetics only, bought with coins earned by playing. Coins are never sold (rule 5).
export interface ShopItem {
  id: string;
  slot: "hat" | "color" | "bg";
  emoji: string;
  /** Mascot tint (color slot) or background gradient (bg slot). */
  value?: string;
  price: number;
  name: L10n;
}

export const SHOP: ShopItem[] = [
  { id: "hat_cap", slot: "hat", emoji: "🧢", price: 30, name: { en: "Cap", uz: "Kepka", ru: "Кепка" } },
  { id: "hat_flower", slot: "hat", emoji: "🌸", price: 25, name: { en: "Flower", uz: "Gul", ru: "Цветок" } },
  { id: "hat_bow", slot: "hat", emoji: "🎀", price: 40, name: { en: "Bow", uz: "Bant", ru: "Бантик" } },
  { id: "hat_party", slot: "hat", emoji: "🥳", price: 50, name: { en: "Party", uz: "Bayram", ru: "Праздник" } },
  { id: "hat_crown", slot: "hat", emoji: "👑", price: 60, name: { en: "Crown", uz: "Toj", ru: "Корона" } },
  { id: "hat_star", slot: "hat", emoji: "✨", price: 80, name: { en: "Sparkles", uz: "Uchqunlar", ru: "Искорки" } },
  { id: "color_sky", slot: "color", emoji: "🩵", value: "#dcebfb", price: 30, name: { en: "Sky", uz: "Osmon", ru: "Небо" } },
  { id: "color_mint", slot: "color", emoji: "💚", value: "#dcf3e6", price: 30, name: { en: "Mint", uz: "Yalpiz", ru: "Мята" } },
  { id: "color_peach", slot: "color", emoji: "🧡", value: "#fde5da", price: 30, name: { en: "Peach", uz: "Shaftoli", ru: "Персик" } },
  { id: "color_lavender", slot: "color", emoji: "💜", value: "#ebe6fb", price: 35, name: { en: "Lavender", uz: "Lavanda", ru: "Лаванда" } },
  { id: "color_sun", slot: "color", emoji: "💛", value: "#fdf1c9", price: 35, name: { en: "Sunny", uz: "Quyoshli", ru: "Солнечный" } },
  { id: "bg_meadow", slot: "bg", emoji: "🌿", value: "linear-gradient(180deg,#eaf5ff 0%,#f4fbef 55%,#dcefd4 100%)", price: 70, name: { en: "Meadow", uz: "Oʻtloq", ru: "Луг" } },
  { id: "bg_beach", slot: "bg", emoji: "🏖️", value: "linear-gradient(180deg,#e2f1fb 0%,#f5f0dc 70%,#f3e2b8 100%)", price: 70, name: { en: "Beach", uz: "Sohil", ru: "Пляж" } },
  { id: "bg_night", slot: "bg", emoji: "🌌", value: "linear-gradient(180deg,#dcd8f5 0%,#e9e6fa 60%,#f4f2fc 100%)", price: 90, name: { en: "Starry", uz: "Yulduzli", ru: "Звёздный" } },
  { id: "bg_snow", slot: "bg", emoji: "❄️", value: "linear-gradient(180deg,#eef4fb 0%,#f8fbff 100%)", price: 70, name: { en: "Snowy", uz: "Qorli", ru: "Снежный" } },
];

export const SHOP_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP.map((s) => [s.id, s]));
