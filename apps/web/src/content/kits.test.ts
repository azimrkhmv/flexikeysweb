import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { KIT } from "./kits";

it("the website's Home Kit is the server's", () => {
  const server = JSON.parse(readFileSync(new URL("../../../api/app/content/kits.json", import.meta.url), "utf8"));
  const box = server.kits.find((k: { slug: string }) => k.slug === KIT.slug);
  expect({ slug: box.slug, priceSom: box.priceSom, items: box.items }).toEqual(KIT);
});
