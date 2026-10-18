import { expect, test, type Page } from "@playwright/test";
import { childStep, fromServer, newPhone, signIn, signUp } from "./helpers";

// B20: a My Voice card made on one device appears on another, with the parent's own photo (A6.8).

// A 1×1 PNG: the parent's photo.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function myVoice(page: Page, childId: string) {
  await page.goto(`/parent/child/${childId}`);
  await page.getByRole("tab", { name: "My Voice" }).click();
}

test("a card made on one device appears on another", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const phone = newPhone("95");
  await signUp(page, phone);
  const childId = await childStep(page, "Aziz");

  await myVoice(page, childId);
  await page.getByLabel("Word on the card").fill("Buvi");
  await page.getByLabel("Your own photo (optional)").setInputFiles({ name: "buvi.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Add card" }).click();
  const card = page.getByRole("listitem").filter({ hasText: "Buvi" });
  await expect(card).toBeVisible();

  // Another device: a fresh browser, the same phone number (a new code may be asked for after 60 seconds).
  await page.waitForTimeout(61_000);
  const other = await (await browser.newContext()).newPage();
  await signIn(other, phone);
  await expect(other).toHaveURL(/\/parent/); // signed in before going on
  await myVoice(other, childId);
  const there = other.getByRole("listitem").filter({ hasText: "Buvi" });
  await expect(there).toBeVisible();
  const [{ photoUrl }] = await fromServer(other, `/children/${childId}/voice-cards`);
  const bytes = await other.evaluate((src) => fetch(src).then((r) => r.arrayBuffer()).then((b) => b.byteLength), photoUrl);
  expect(bytes).toBe(PNG.length); // the photo, from file storage

  await there.getByRole("button", { name: "Delete Buvi" }).click(); // removed on the second device
  await expect(there).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: "My Voice" }).click();
  await expect(card).toHaveCount(0); // and gone on the first
});
