import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B29 (spec §12): emergency words show 103 before anything else, in each of the 4 languages.

const SAID = ["He had a seizure ten minutes ago", "У ребёнка судороги, что делать?", "Bolada tutqanoq boʻldi", "Болада тутқаноқ бўлди"];

test("emergency words in 4 languages show 103 first", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/assistant");
  const box = page.getByLabel("Type your question");
  for (const [i, text] of SAID.entries()) {
    await box.fill(text);
    await box.press("Enter");
    const alerts = page.getByRole("alert").filter({ hasText: "103" });
    await expect(alerts).toHaveCount(i + 1);
    await expect(alerts.last().getByRole("link", { name: "Call 103" })).toHaveAttribute("href", "tel:103");
  }
  await box.fill("How long should we play today?"); // a calm question gets an ordinary answer
  await box.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "103" })).toHaveCount(4);
});
