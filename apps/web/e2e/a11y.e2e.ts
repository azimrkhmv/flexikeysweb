import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// PRD §36.7: axe reports no serious or critical issues on adult pages; child pages are scanned too.
async function scan(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("h1").first()).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${path} ${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

test.describe("axe", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one viewport is enough for rule checks");
    await setup(page);
  });

  for (const path of ["/", "/pricing", "/privacy", "/login", "/signup", "/forgot-password", "/class", "/demo"])
    test(`public ${path}`, async ({ page }) => scan(page, path));

  test("parent area", async ({ page }) => {
    await loginAs(page, "Parent");
    for (const p of ["/parent", "/parent/child/ch_ali", "/parent/children/new", "/parent/reports", "/parent/billing", "/parent/assistant", "/parent/account"]) await scan(page, p);
  });

  test("teacher, therapist and admin areas", async ({ page }) => {
    await loginAs(page, "Teacher");
    for (const p of ["/teacher", "/teacher/class/cl_sun"]) await scan(page, p);
    await page.goto("/login");
    await loginAs(page, "Therapist");
    for (const p of ["/therapist", "/therapist/child/ch_ali"]) await scan(page, p);
    await loginAs(page, "Admin");
    for (const p of ["/admin", "/admin/users", "/admin/content", "/admin/audit"]) await scan(page, p);
  });

  test("child mode start screen", async ({ page }) => {
    await loginAs(page, "Parent");
    await page.goto("/parent/child/ch_ali");
    await page.getByRole("button", { name: "Play now" }).click();
    await scan(page, "/play");
  });
});

test("child page tabs work with arrow keys", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/child/ch_ali");
  const progress = page.getByRole("tab", { name: "Progress" });
  await progress.focus();
  await page.keyboard.press("ArrowRight");
  const changes = page.getByRole("tab", { name: "What changed and why" });
  await expect(changes).toBeFocused();
  await expect(changes).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "What changed and why" })).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Privacy" })).toBeFocused();
  await page.keyboard.press("ArrowRight"); // wraps
  await expect(progress).toBeFocused();
});

test("game replay and watch-again are full-size child targets", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await page.goto("/demo");
  await page.getByRole("button", { name: /Colors in order/ }).click();
  for (const name of ["Listen again", "Show me again"]) {
    const b = page.locator(`[data-fk-target][aria-label="${name}"]`);
    await expect(b).toHaveCount(1);
    const box = (await b.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(64);
  }
});
