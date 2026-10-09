import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yIssues, loginAs, setup } from "./helpers";

// PRD §36.7: axe reports no serious or critical issues on adult pages; child pages are scanned too.
async function scan(page: Page, path: string) {
  await page.goto(path);
  if (path.includes("#")) await page.reload(); // a hash-only change keeps the old tab mounted
  await expect(page.locator("h1").first()).toBeVisible();
  await expectNoA11yIssues(page, path);
}

test.describe("axe", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one viewport is enough for rule checks");
    await setup(page);
  });

  for (const path of ["/", "/pricing", "/privacy", "/login", "/signup", "/forgot-password", "/demo"])
    test(`public ${path}`, async ({ page }) => scan(page, path));

  test("parent area", async ({ page }) => {
    await loginAs(page, "Parent");
    for (const p of ["/parent", "/parent/child/ch_ali", "/parent/child/ch_ali#aac", "/parent/children/new", "/parent/reports", "/parent/billing", "/parent/assistant", "/parent/account"]) await scan(page, p);
  });

  // The teacher area is legacy (hidden by the product spec of 2026-10-06); the video reviewer replaces it here.
  test("reviewer, therapist and admin areas", async ({ page }) => {
    await loginAs(page, "Video reviewer");
    await scan(page, "/physio");
    await loginAs(page, "Therapist");
    for (const p of ["/therapist", "/therapist/child/ch_ali"]) await scan(page, p);
    await loginAs(page, "Admin");
    for (const p of ["/admin", "/admin/users", "/admin/billing", "/admin/content", "/admin/audit"]) await scan(page, p);
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
  const plan = page.getByRole("tab", { name: "Plan" });
  await plan.focus();
  await page.keyboard.press("ArrowRight");
  const progress = page.getByRole("tab", { name: "Progress" });
  await expect(progress).toBeFocused();
  await expect(progress).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Progress" })).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Privacy" })).toBeFocused();
  await page.keyboard.press("ArrowRight"); // wraps
  await expect(plan).toBeFocused();
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

// Phones (PRD §36.5): every role's pages fit a 375 px screen with no sideways scrolling.
test.describe("phone width", () => {
  test.use({ viewport: { width: 375, height: 740 }, hasTouch: true });
  const AREAS = {
    Parent: ["/parent", "/parent/child/ch_ali", "/parent/child/ch_ali#aac", "/parent/children/new", "/parent/reports", "/parent/billing", "/parent/assistant", "/parent/account"],
    "Video reviewer": ["/physio"],
    Therapist: ["/therapist", "/therapist/child/ch_ali"],
    Admin: ["/admin", "/admin/users", "/admin/billing", "/admin/content", "/admin/audit"],
  } as const;
  async function fits(page: Page, path: string) {
    await page.goto(path);
    if (path.includes("#")) await page.reload();
    await expect(page.locator("h1").first()).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, `${path} scrolls sideways by ${over}px`).toBeLessThanOrEqual(0);
  }
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the viewport is set here");
    await setup(page);
  });
  test("public pages", async ({ page }) => {
    for (const p of ["/", "/pricing", "/privacy", "/login", "/signup", "/demo"]) await fits(page, p);
  });
  for (const [role, paths] of Object.entries(AREAS) as [keyof typeof AREAS, readonly string[]][])
    test(`${role} area`, async ({ page }) => {
      await loginAs(page, role);
      for (const p of paths) await fits(page, p);
    });
});
