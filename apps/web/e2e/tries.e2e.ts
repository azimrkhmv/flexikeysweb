import { expect, test } from "@playwright/test";
import { childPress, loginAs, setup } from "./helpers";

// B14: every try is saved in the spec's shape; a double press is an access event, never a wrong answer.

test("a double press in a game is saved as an access event, not as a wrong answer", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one keyboard is enough");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/child/ch_ali");
  await page.getByRole("button", { name: "Play now" }).click();
  await childPress(page.getByRole("button", { name: "Boshlash" })); // straight into Ali's next game

  const target = page.locator("main [data-fk-target]:not([disabled])").last();
  await page.waitForTimeout(700);
  await target.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter"); // too soon after the first: a tremor, not a choice

  const tries = () =>
    page.evaluate(() => (JSON.parse(localStorage.getItem("fk_db_v1")!).tries as { accessEvent: boolean; outcome: string; childId: string }[]) ?? []);
  await expect.poll(async () => (await tries()).some((t) => t.accessEvent), { timeout: 10_000 }).toBe(true); // sent within 5 s
  const saved = await tries();
  expect(saved.filter((t) => t.accessEvent).every((t) => t.outcome === "skipped" && t.childId === "ch_ali")).toBe(true);
});
