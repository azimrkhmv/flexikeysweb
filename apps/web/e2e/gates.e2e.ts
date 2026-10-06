import { expect, test, type Page } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// Free level choice: a child opens any level they have access to, in any order. The only lock is access
// (the family plan); teacher/therapist assignments never change it.
// Seed: Ali (full access via class + therapist link) has finished levels 1–5 and started 6; his therapist
// recommended "Body parts" (level 11). Jasur is on the free plan with no school or therapist link.

const MAP = "Qayerga boramiz?"; // the children's UI language is Uzbek

async function startChildMode(page: Page, childId: string) {
  await page.goto(`/parent/child/${childId}`);
  await page.getByRole("button", { name: "Play now" }).click();
  await page.getByRole("button", { name: "Boshlash" }).press("Enter");
  await expect(page.getByRole("heading", { name: MAP })).toBeVisible(); // Start opens the map: the child chooses
}

test.describe("free level choice", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await setup(page);
  });

  test("child: any level opens straight from the map or a task tile, whatever came before", async ({ page }) => {
    await loginAs(page, "Parent");
    await startChildMode(page, "ch_ali");
    await expect(page.getByRole("progressbar", { name: "16 ta darajadan 5 tasi tugallangan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Harflar — tugallangan, yana oʻynash mumkin", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hayvonlar — boshlangan, davom ettiramiz", exact: true })).toBeVisible();

    // Level 14, far beyond level 6.
    await page.getByRole("button", { name: "Oddiy soʻzlar — yangi", exact: true }).press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Oddiy soʻzlar" })).toBeVisible();
    await page.getByRole("button", { name: "Orqaga" }).press("Enter");

    // The therapist's task (level 11) opens too.
    const task = page.locator("section").getByRole("button", { name: "Tana aʼzolari", exact: true }).first();
    await task.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Tana aʼzolari" })).toBeVisible();
  });

  test("child: games sorted by type beside the map — a word game starts with one tap", async ({ page }) => {
    await loginAs(page, "Parent");
    await startChildMode(page, "ch_ali");
    const panel = page.getByRole("region", { name: "Barcha oʻyinlar" });
    await expect(panel.getByText("Harf va soʻz yozish")).toBeVisible(); // the typing group is open first
    await expect(panel.getByRole("button", { name: /^Harfni top — Harflar — tugallangan/ })).toBeVisible(); // finished: ⭐
    await panel.getByRole("button", { name: /^Chizish — / }).press("Enter"); // switch group
    await expect(panel.getByRole("button", { name: /^Rasm chizish — Ranglar/ })).toBeVisible();
    await panel.getByRole("button", { name: /^Harf va soʻz yozish — / }).press("Enter");
    await panel.getByRole("button", { name: "Soʻzni yoz — Oddiy soʻzlar" }).press("Enter"); // level 14
    await expect(page.getByRole("heading", { name: MAP })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Klaviatura" })).toBeVisible(); // straight into the typing game
  });

  test("child on the free plan: paid levels stay asleep, free ones open in any order", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("family@demo.uz");
    await page.getByLabel("Password").fill("demo12345");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/parent$/);
    await startChildMode(page, "ch_other");

    await page.getByRole("button", { name: "Oila", exact: true }).press("Enter"); // level 5: needs the plan
    await page.waitForTimeout(400);
    await expect(page.getByRole("heading", { name: MAP })).toBeVisible(); // still on the map
    await expect(page.getByRole("heading", { level: 1, name: "Oila" })).toHaveCount(0);

    await page.getByRole("button", { name: "Ranglar — yangi", exact: true }).press("Enter"); // level 4 before 1–3
    await expect(page.getByRole("heading", { level: 1, name: "Ranglar" })).toBeVisible();
  });

  test("parent, therapist and teacher see progress from real completions and no sequence lock", async ({ page }) => {
    await loginAs(page, "Parent");
    await page.goto("/parent/child/ch_ali");
    await expect(page.getByText("5 of 16 levels finished (31%)")).toBeVisible();
    await page.goto("/parent");
    await expect(page.getByText(/Opens after/)).toHaveCount(0); // the therapist's level-11 task isn't locked

    await loginAs(page, "Therapist");
    await page.goto("/therapist/child/ch_ali");
    await expect(page.getByText(/Opens after/)).toHaveCount(0);

    await loginAs(page, "Teacher");
    await page.goto("/teacher/class/cl_sun");
    await expect(page.getByText(/Not open yet for/)).toHaveCount(0); // class children have access to every level
    await expect(page.getByText(/Children can play any level they have access to, in any order/)).toBeVisible();
  });
});
