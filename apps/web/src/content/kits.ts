import { KIT_TOOLS } from "./exercises";

// Home Kit (spec §9): the standard box. PLACEHOLDER price and items until G3; the server's
// apps/api/app/content/kits.json says the same (kits.test.ts checks it).
export const KIT = { slug: "standard", priceSom: 290_000, items: [...KIT_TOOLS] as string[] };
