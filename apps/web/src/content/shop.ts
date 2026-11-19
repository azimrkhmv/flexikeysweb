import type { L10n } from "@/lib/types";

// Cloud shop: cosmetics only, bought with coins earned by playing. Coins are never sold (rule 5).
export interface ShopItem {
  id: string;
  slot: "hat" | "color" | "bg";
  emoji: string;
  /**
   * Mascot tint (color slot) or background gradient (bg slot). Both are tones of the child's colour scheme (Update 3
   * spec 2, 19 Nov 2026: every colour follows the scheme), so a coat or a background never clashes with the page.
   */
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
  { id: "color_sky", slot: "color", emoji: "💙", value: "var(--sky2)", price: 30, name: { en: "Sky", uz: "Osmon", ru: "Небо" } },
  { id: "color_mint", slot: "color", emoji: "💚", value: "var(--tint2)", price: 30, name: { en: "Mint", uz: "Yalpiz", ru: "Мята" } },
  { id: "color_peach", slot: "color", emoji: "🧡", value: "var(--cheek)", price: 30, name: { en: "Peach", uz: "Shaftoli", ru: "Персик" } },
  { id: "color_lavender", slot: "color", emoji: "💜", value: "var(--accentSoft)", price: 35, name: { en: "Lavender", uz: "Lavanda", ru: "Лаванда" } },
  { id: "color_sun", slot: "color", emoji: "💛", value: "var(--sunSoft)", price: 35, name: { en: "Sunny", uz: "Quyoshli", ru: "Солнечный" } },
  { id: "bg_meadow", slot: "bg", emoji: "🌿", value: "linear-gradient(180deg, var(--sky1) 0%, var(--hillFar) 55%, var(--hill1) 100%)", price: 70, name: { en: "Meadow", uz: "Oʻtloq", ru: "Луг" } },
  { id: "bg_beach", slot: "bg", emoji: "🏖️", value: "linear-gradient(180deg, var(--sky1) 0%, var(--sunSoft) 70%, var(--hillFar) 100%)", price: 70, name: { en: "Beach", uz: "Sohil", ru: "Пляж" } },
  { id: "bg_night", slot: "bg", emoji: "🌌", value: "linear-gradient(180deg, var(--hill2) 0%, var(--tint2) 60%, var(--sky1) 100%)", price: 90, name: { en: "Starry", uz: "Yulduzli", ru: "Звёздный" } },
  { id: "bg_snow", slot: "bg", emoji: "❄️", value: "linear-gradient(180deg, var(--sky1) 0%, var(--paperSolid) 100%)", price: 70, name: { en: "Snowy", uz: "Qorli", ru: "Снежный" } },
];

export const SHOP_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP.map((s) => [s.id, s]));
