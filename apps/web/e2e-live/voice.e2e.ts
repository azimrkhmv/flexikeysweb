import { expect, test } from "@playwright/test";
import { abilities, childStep, fromServer, goals, healthAndSafety, newPhone, signIn, signUp, skip } from "./helpers";

// A2.9: the P39 voice note is stored on the server: recorded on one device, heard again on another.
// The browser's fake microphone (playwright.live.config.ts) records a test tone.

test("a voice note recorded on one device plays on another", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const phone = newPhone("96");
  await signUp(page, phone);
  const childId = await childStep(page, "Aziz");
  await healthAndSafety(page);
  for (const step of ["talking", "hands and moving", "seeing, hearing, daily life"]) await abilities(page, step);
  await goals(page);
  await skip(page); // routine

  await expect(page.getByRole("heading", { level: 1, name: "In your own words" })).toBeVisible();
  await page.getByRole("button", { name: "Record a voice note" }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.getByText(/Voice note saved/)).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click(); // saves the step
  await expect(page.getByRole("heading", { level: 1, name: "Movement videos" })).toBeVisible();

  // Back on the step: the note plays from the server's file storage.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Listen to your voice note")).toHaveAttribute("src", /^https?:\/\//);

  // Another device: a fresh browser, the same phone number (a new code may be asked for after 60 seconds).
  await page.waitForTimeout(61_000);
  const other = await (await browser.newContext()).newPage();
  await signIn(other, phone);
  await expect(other).toHaveURL(/\/parent/);
  const { url } = await fromServer(other, `/children/${childId}/intake/1/voice`);
  const bytes = await other.evaluate((src) => fetch(src).then((r) => r.arrayBuffer()).then((b) => b.byteLength), url);
  expect(bytes).toBeGreaterThan(100);
});
