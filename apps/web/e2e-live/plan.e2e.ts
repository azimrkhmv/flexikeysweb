import { expect, test } from "@playwright/test";
import { abilities, approvedVideo, childStep, goals, healthAndSafety, newPhone, signUp, skip } from "./helpers";

// B6: the parent sees the real 4-week plan the server built, with the approved exercises in it.

test("a parent sees the real 4-week plan from the server", async ({ page }) => {
  test.setTimeout(120_000);
  await approvedVideo("putty_squeeze", "en"); // a physiotherapist approved its English video

  await signUp(page, newPhone("98"));
  await childStep(page, "Aziz");
  await healthAndSafety(page);
  for (const step of ["talking", "hands and moving", "seeing, hearing, daily life"]) await abilities(page, step);
  await goals(page);
  for (let i = 0; i < 3; i++) await skip(page); // routine, own words, videos
  await page.getByRole("button", { name: "Make the plan" }).click();
  await page.getByRole("link", { name: "See the plan" }).click();

  await expect(page.getByRole("heading", { name: "Why this plan" })).toBeVisible();
  let putty = 0;
  for (let w = 1; w <= 4; w++) {
    await page.getByRole("button", { name: `Week ${w}` }).click();
    const days = page.locator("li").filter({ has: page.getByText("Games", { exact: true }) });
    await expect(days).toHaveCount(7);
    putty += await page.getByText("Squeeze the putty").count();
  }
  expect(putty).toBeGreaterThan(0); // the approved exercise, by name, from the server
});
