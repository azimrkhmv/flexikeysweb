import { expect, test } from "@playwright/test";
import { childPress, loginAs, setup } from "./helpers";

// FR-CUR-4: teacher/therapist assignments point the way but never open a level the child hasn't unlocked.
// Seed: Ali's therapist recommended "Body parts" (level 11); Ali has only reached level 6.
test.describe("assignments vs level gates", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await setup(page);
  });

  test("child: a locked task tile stays asleep and does not open the level", async ({ page }) => {
    await loginAs(page, "Parent");
    await page.goto("/parent/child/ch_ali");
    await page.getByRole("button", { name: "Play now" }).click();
    await childPress(page.getByRole("button", { name: "Boshlash" })); // Ali's UI language is Uzbek
    await childPress(page.getByRole("button", { name: "Orqaga" })); // activity → level
    await childPress(page.getByRole("button", { name: "Orqaga" })); // level → map
    await expect(page.getByRole("heading", { name: "Qayerga boramiz?" })).toBeVisible();
    const task = page.getByRole("region").or(page.locator("section")).getByRole("button", { name: "Tana aʼzolari" }).first();
    await childPress(task);
    await page.waitForTimeout(400);
    await expect(page.getByRole("heading", { name: "Qayerga boramiz?" })).toBeVisible(); // still on the map
    await expect(page.getByRole("heading", { level: 1, name: "Tana aʼzolari" })).toHaveCount(0);
  });

  test("parent and therapist see why the level is still closed", async ({ page }) => {
    await loginAs(page, "Parent");
    await expect(page.getByText("Opens after “Transport” is finished")).toBeVisible();

    await loginAs(page, "Therapist");
    await page.goto("/therapist/child/ch_ali");
    await expect(page.getByText("Opens after “Transport” is finished")).toBeVisible();

  });
});
