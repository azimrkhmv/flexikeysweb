import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B96: a parent sees every skill game right away and tries one with nothing saved; "For your child" shows the games
// of the child's plan.
test("a parent sees all games, tries one, and sees the games of the child's plan", async ({ page }) => {
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/games");
  const main = page.locator("main").last();
  await expect(main.getByRole("heading", { name: "Games", level: 1 })).toBeVisible();
  await expect(main.getByRole("link", { name: /^Try/ })).toHaveCount(37);
  for (const area of ["Attention", "Memory", "Flexibility", "Reasoning", "Language", "Math", "Speed"]) await expect(main.getByRole("heading", { name: area, level: 2 })).toBeVisible();
  // Rule 1: no percentage on a parent screen.
  expect(await main.innerText()).not.toMatch(/\d\s?%/);

  await main.getByRole("link", { name: /^Try.*Find the same one/ }).click();
  await expect(page).toHaveURL(/\/demo\/games\?game=find_same&from=parent/);
  await expect(page.getByRole("heading", { name: "All skill games" })).toBeAttached();
  await page.getByRole("link", { name: "Back to Games" }).click();
  await expect(page).toHaveURL(/\/parent\/games/);

  await page.locator("main").last().getByRole("button", { name: "For your child" }).click();
  await expect(page.getByRole("heading", { name: "Games in Ali's plan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play with Ali" })).toBeVisible();
  await page.getByRole("radio", { name: "Madina" }).click();
  await expect(page.getByRole("heading", { name: "Games in Ali's plan" })).toHaveCount(0);
});
