import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// Child mode speaks the child's own UI language — Ali's is Uzbek.
const WORDS: Record<string, number> = { uch: 3, "toʻrt": 4, besh: 5, olti: 6, yetti: 7, sakkiz: 8, "toʻqqiz": 9 };

// FR-PLAY-3: a child in child mode cannot reach parent areas without the parent gate.
test("child mode can only be left through the parent gate", async ({ page }) => {
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/child/ch_ali");
  await page.getByRole("button", { name: "Play now" }).click();
  await expect(page).toHaveURL(/\/play$/);
  const start = page.getByRole("button", { name: "Boshlash" });
  await expect(start).toBeVisible();

  // Browser Back and a typed URL both land back in child mode.
  await page.goBack();
  await expect(page).toHaveURL(/\/play$/);
  await page.goto("/parent");
  await expect(page).toHaveURL(/\/play$/);
  await expect(start).toBeVisible();

  // The real way out: Pause → For grown-ups → hold 2 s → answer the sum (written in words).
  await page.getByRole("button", { name: "Pauza" }).press("Enter");
  await page.getByRole("button", { name: "Kattalar uchun" }).press("Enter");
  await page.getByRole("button", { name: "2 soniya bosib turing" }).focus();
  await page.keyboard.down("Enter");
  await page.waitForTimeout(2200);
  await page.keyboard.up("Enter");
  const q = await page.getByText(/qoʻshuv .+ necha boʻladi\?/).innerText();
  const [, a, b] = q.match(/^(\S+) qoʻshuv (\S+) necha/)!;
  await page.getByRole("button", { name: String(WORDS[a] + WORDS[b]), exact: true }).click();
  await expect(page).toHaveURL(/\/parent$/);
});
