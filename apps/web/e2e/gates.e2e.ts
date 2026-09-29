import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

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
    await page.getByRole("button", { name: "Boshlash" }).press("Enter"); // Ali's UI language is Uzbek
    await page.getByRole("button", { name: "Orqaga" }).press("Enter"); // activity → level
    await page.getByRole("button", { name: "Orqaga" }).press("Enter"); // level → map
    await expect(page.getByRole("heading", { name: "Qayerga boramiz?" })).toBeVisible();
    const task = page.getByRole("region").or(page.locator("section")).getByRole("button", { name: "Tana aʼzolari" }).first();
    await task.press("Enter");
    await page.waitForTimeout(400);
    await expect(page.getByRole("heading", { name: "Qayerga boramiz?" })).toBeVisible(); // still on the map
    await expect(page.getByRole("heading", { level: 1, name: "Tana aʼzolari" })).toHaveCount(0);
  });

  test("parent, therapist and teacher see why the level is still closed", async ({ page }) => {
    await loginAs(page, "Parent");
    await expect(page.getByText("Opens after “Transport” is finished")).toBeVisible();

    await loginAs(page, "Therapist");
    await page.goto("/therapist/child/ch_ali");
    await expect(page.getByText("Opens after “Transport” is finished")).toBeVisible();

    await loginAs(page, "Teacher");
    await page.goto("/teacher/class/cl_sun");
    await expect(page.getByText("Not open yet for 4 of 5 children")).toBeVisible(); // "Animals": open only for Ali
    await expect(page.getByText(/Assignments point the way/)).toBeVisible();
  });
});
