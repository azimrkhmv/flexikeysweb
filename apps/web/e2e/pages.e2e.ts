import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { setup } from "./helpers";

test("unknown URLs get the branded 404 page in the visitor's language", async ({ page }) => {
  await setup(page, "ru");
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Мы не нашли эту страницу" })).toBeVisible();
  await expect(page.getByRole("link", { name: "На главную" })).toHaveAttribute("href", "/");
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});
