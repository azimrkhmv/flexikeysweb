import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// Escape closes popups and dialogs where closing is safe; focus returns to what opened them.
test.describe("Escape key", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await setup(page);
  });

  test("notifications popover: Escape and outside click close it", async ({ page }) => {
    await loginAs(page, "Parent");
    const bell = page.getByRole("button", { name: /^Notifications/ });
    await bell.click();
    await expect(bell).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(bell).toHaveAttribute("aria-expanded", "false");
    await expect(bell).toBeFocused();
    await bell.click();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(bell).toHaveAttribute("aria-expanded", "false");
  });

  // Legacy teacher area: hidden by the product spec of 2026-10-06 (the `legacy` flag brings it back).
  test.skip("adult modal dialog closes with Escape", async ({ page }) => {
    await loginAs(page, "Teacher");
    await page.getByRole("button", { name: "New class" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test.skip("classroom mode closes with Escape", async ({ page }) => {
    await loginAs(page, "Teacher");
    await page.goto("/teacher/class/cl_sun");
    await page.getByRole("button", { name: "Classroom mode" }).click();
    await expect(page.getByRole("dialog", { name: "Classroom mode" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Classroom mode" })).toHaveCount(0);
  });

  test("child mode: Escape continues playing from the pause menu and the parent gate — it never exits", async ({ page }) => {
    await loginAs(page, "Parent");
    await page.goto("/parent/child/ch_ali");
    await page.getByRole("button", { name: "Play now" }).click();
    const pause = page.getByRole("button", { name: "Pauza" });
    await pause.press("Enter");
    await expect(page.getByRole("dialog", { name: "Pauza" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(pause).toBeFocused();

    await pause.press("Enter");
    await page.getByRole("button", { name: "Kattalar uchun" }).press("Enter");
    await expect(page.getByRole("dialog", { name: "Kattalar uchun" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/play$/);
  });
});

test("mobile marketing menu: Escape and outside click close it", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/en");
  const toggle = page.getByLabel("Menu", { exact: true }).and(page.locator("summary"));
  const link = page.locator("details").getByRole("link", { name: "Pricing" });
  await toggle.click();
  await expect(link).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(link).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await expect(link).toBeVisible();
  await page.waitForTimeout(150); // <details> reports "toggle" asynchronously; a person can't click faster than this
  await page.mouse.click(20, 760); // outside the open menu
  await expect(link).toBeHidden();
});
