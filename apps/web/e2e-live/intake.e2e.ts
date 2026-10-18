import { expect, test } from "@playwright/test";
import { abilities, childStep, fromServer, goals, healthAndSafety, newPhone, signUp, skip } from "./helpers";

// B4: the parent questions against the real server: answer half, stop, come back later, finish, get a plan.

test("a parent answers half the questions, stops, continues later and gets a plan", async ({ page }) => {
  await signUp(page, newPhone("95"));
  const childId = await childStep(page, "Aziz");
  await healthAndSafety(page);
  await abilities(page, "talking");

  // Stop halfway: a new page load knows nothing but what the server saved.
  await page.goto(`/parent/child/${childId}#plan`);
  await page.reload();
  await page.getByRole("link", { name: "Continue the questions" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Everyday abilities: hands and moving" })).toBeVisible();

  await abilities(page, "hands and moving");
  await abilities(page, "seeing, hearing, daily life");
  await goals(page);
  await skip(page); // routine
  await skip(page); // own words
  await skip(page); // videos
  await page.getByRole("button", { name: "Make the plan" }).click();
  await expect(page.getByRole("heading", { name: "Aziz's plan is ready" })).toBeVisible();
  expect((await fromServer(page, `/children/${childId}/plan`)).days).toHaveLength(28);
});
