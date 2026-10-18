import { expect, test } from "@playwright/test";
import { abilities, approvedVideo, childStep, goals, healthAndSafety, newPhone, serverCommand, signUp, skip } from "./helpers";

// B11: Done with easy / OK / hard, the daily question and pause today, saved on the real server.

test("Today against the server: Done, how it went, the daily question, pause and undo", async ({ page }) => {
  test.setTimeout(120_000);
  await approvedVideo("putty_squeeze", "en");
  serverCommand("load-daily-questions");

  await signUp(page, newPhone("97"));
  await childStep(page, "Aziz");
  await healthAndSafety(page);
  for (const step of ["talking", "hands and moving", "seeing, hearing, daily life"]) await abilities(page, step);
  await goals(page);
  for (let i = 0; i < 3; i++) await skip(page); // routine, own words, videos
  await page.getByRole("button", { name: "Make the plan" }).click();
  await expect(page.getByRole("link", { name: "See the plan" })).toBeVisible();
  await page.goto("/parent");

  const aziz = page.getByRole("region", { name: "Today" }).getByRole("article").filter({ hasText: "Aziz" });
  const exercise = aziz.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Done" }) }).first();
  const title = await exercise.locator("p.font-extrabold").innerText();
  await exercise.getByRole("button", { name: "Done" }).click();
  const item = aziz.getByRole("listitem").filter({ hasText: title });
  await item.getByRole("button", { name: "Hard" }).click();
  await expect(item.getByRole("button", { name: "Hard" })).toHaveAttribute("aria-pressed", "true");

  const daily = aziz.getByRole("group").filter({ hasText: "Question of the day" });
  await daily.getByRole("button", { name: "Yes" }).click();
  await expect(daily.getByText("Thank you.", { exact: false })).toBeVisible();

  await page.reload(); // everything above comes back from the server
  await expect(item.getByRole("button", { name: "Hard" })).toHaveAttribute("aria-pressed", "true");
  await expect(daily.getByRole("button", { name: "Yes" })).toHaveAttribute("aria-pressed", "true");

  await aziz.getByRole("button", { name: "Pause today" }).click();
  await expect(aziz.getByText("Paused today. Rest well: the plan continues tomorrow.")).toBeVisible();
  await page.reload();
  await expect(aziz.getByText("Paused today. Rest well: the plan continues tomorrow.")).toBeVisible();
  await expect(aziz.getByRole("list", { name: "This week" }).getByRole("listitem").filter({ hasText: "Paused" })).toHaveCount(1);
  await aziz.getByRole("button", { name: "Undo the pause" }).click();
  await expect(item.getByRole("button", { name: "Hard" })).toHaveAttribute("aria-pressed", "true");
});
