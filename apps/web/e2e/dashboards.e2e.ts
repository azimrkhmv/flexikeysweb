import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// Text snapshots of every dashboard with the seeded demo data and a fixed clock. They guard refactors of the
// data layer: the same data must render the same words. Update intentionally with `--update-snapshots`.
const PAGES: Record<"Parent" | "Teacher" | "Therapist" | "Admin", string[]> = {
  Parent: [
    "/parent",
    "/parent/child/ch_ali#progress",
    "/parent/child/ch_ali#changes",
    "/parent/child/ch_ali#aac",
    "/parent/child/ch_ali#sharing",
    "/parent/child/ch_ali#privacy",
    "/parent/reports",
    "/parent/billing",
    "/parent/assistant",
  ],
  Teacher: ["/teacher", "/teacher/class/cl_sun", "/teacher/child/ch_ali"],
  Therapist: ["/therapist", "/therapist/child/ch_ali"],
  Admin: ["/admin", "/admin/users", "/admin/billing", "/admin/content", "/admin/audit"],
};

for (const [role, paths] of Object.entries(PAGES) as [keyof typeof PAGES, string[]][]) {
  test(`${role} dashboards render the seeded data`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "text snapshots are viewport-independent");
    await setup(page);
    await loginAs(page, role);
    for (const path of paths) {
      await page.goto(path);
      if (path.includes("#")) await page.reload(); // a hash-only change keeps the old tab mounted
      const main = page.locator("main").last();
      await expect(main.locator("h1").first()).toBeVisible();
      const text = (await main.innerText()).replace(/[ \t]+\n/g, "\n");
      expect(text).toMatchSnapshot(`${role}${path.replace(/[/#]+/g, "_")}.txt`);
    }
  });
}
