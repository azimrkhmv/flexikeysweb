import { expect, test } from "@playwright/test";
import { exitThroughGate } from "../e2e/helpers";

// Phase-one path on the real backend (PRD §28 core flow): sign up → consent → child → play a real activity
// → server-granted reward → adaptive session end → the parent sees progress, changes and consents.
test("parent signs up, adds a child, the child plays, the parent sees it — all on the server", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  const email = `live.${Date.now()}@example.com`;

  await page.goto("/signup");
  await expect(page.getByText("Therapist", { exact: true })).toHaveCount(0); // no therapist role on the server yet
  await page.getByLabel("Your name").fill("Nodira");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("long-enough-password");
  await page.getByText("I agree to the Terms of use and the Privacy policy").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email$/);

  // Auth is in httpOnly cookies: JavaScript can't see the tokens.
  const visible = await page.evaluate(() => document.cookie);
  expect(visible).toContain("fk_csrf=");
  expect(visible).not.toContain("fk_access");
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "fk_access")?.httpOnly).toBe(true);

  // Consent first (FR-CHILD-1), then the child is created on the server.
  await page.goto("/parent/children/new");
  await page.getByText("Core: store my child's nickname").click();
  await page.getByText("AI help: send anonymous").click(); // an optional scope, stored with the child
  await page.getByRole("button", { name: "I agree, continue" }).click();
  await page.getByLabel("Nickname").fill("Lola");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lola" })).toBeVisible();

  // Survives a reload: the session is the server's cookie, not localStorage.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Lola" })).toBeVisible();

  // Child mode → the first typing activity with the physical keyboard.
  await page.getByRole("button", { name: "Play now" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole("button", { name: "Start" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Find this letter on the keyboard" })).toBeVisible({ timeout: 8000 });
  for (let round = 0; round < 10; round++) {
    const letter = (await page.locator("span.text-8xl").innerText()).trim();
    await page.waitForTimeout(300);
    await page.keyboard.press(letter);
    const next = page.locator("[data-fk-target][aria-label='Next'], [data-fk-target][aria-label='Done']");
    await expect(next).toBeVisible();
    const done = (await next.getAttribute("aria-label")) === "Done";
    await next.press("Enter");
    if (done) break;
  }
  await expect(page.getByRole("heading", { name: "You did it! Great effort." })).toBeVisible();
  await expect(page.getByText("⭐ +3")).toBeVisible(); // granted by POST /activities/complete

  await exitThroughGate(page, "en"); // ends the session → the server adapts once, in the background
  await expect(page).toHaveURL(/\/parent$/);

  await page.getByRole("link", { name: /Lola/ }).click();
  const stars = page.getByText("Stars earned", { exact: true }).locator("..");
  await expect(stars).toHaveText(/^\s*3\s*Stars earned\s*$/);
  await expect(page.getByText("Coins", { exact: true }).locator("..")).toHaveText(/^\s*5\s*Coins\s*$/);

  await page.getByRole("tab", { name: "Privacy" }).click();
  await expect(page.getByText("Core: store my child's nickname")).toBeVisible();
  const ai = page.getByRole("switch", { name: /^AI help/ });
  await expect(ai).toHaveAttribute("aria-checked", "true"); // consent stored on the server
  await ai.click(); // withdraw → DELETE /children/{id}/consent/ai_processing
  await expect(ai).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await page.getByRole("tab", { name: "Privacy" }).click();
  await expect(page.getByRole("switch", { name: /^AI help/ })).toHaveAttribute("aria-checked", "false");
  await page.getByRole("tab", { name: "Sharing" }).click();
  await expect(page.getByText("Coming soon")).toBeVisible(); // not connected yet — says so honestly
});
