import { expect, test } from "@playwright/test";
import { exitThroughGate, loginAs, setup } from "./helpers";

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
  await exitThroughGate(page, "uz");
  await expect(page).toHaveURL(/\/parent$/);
});
