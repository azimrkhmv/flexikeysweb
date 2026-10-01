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

// Session handling on the server, and nothing unconnected is offered as if it worked.
test("log out and back in; parts the server can't do yet aren't offered", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  const email = `live.auth.${Date.now()}@example.com`;
  const password = "long-enough-password";

  await page.goto("/signup");
  await expect(page.getByText("Teacher", { exact: true })).toHaveCount(0); // only the parent area is connected
  await page.getByLabel("Your name").fill("Aziz");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByText("I agree to the Terms of use and the Privacy policy").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email$/);

  await page.goto("/parent");
  await expect(page.getByRole("button", { name: /^Notifications/ })).toHaveCount(0); // not connected
  await page.goto("/parent/account");
  await expect(page.getByText("Coming soon")).toBeVisible(); // account deletion isn't on the server yet
  await page.getByRole("button", { name: "Log out" }).first().click();
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "fk_access")).toBe(false);

  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveCount(0); // no email transport yet
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password-123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is not correct.")).toBeVisible();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/parent/);
  await page.goto("/forgot-password");
  await expect(page.getByText("Coming soon")).toBeVisible();
});

// No consent recorded (a profile mirrored from the mobile app) = no consent: explained, then fixed by the parent.
test("a profile without a consent record can't start child mode until the parent consents", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Malika");
  await page.getByLabel("Email").fill(`live.consent.${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("long-enough-password");
  await page.getByText("I agree to the Terms of use and the Privacy policy").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email$/);

  // The mobile app's mirror call: POST /children without consents (same cookie session + CSRF header).
  const csrf = (await page.context().cookies()).find((c) => c.name === "fk_csrf")?.value ?? "";
  const res = await page.request.post("/api/v1/children", {
    headers: { "X-Auth-Transport": "cookie", "X-CSRF-Token": csrf },
    data: { display_name: "Timur" },
  });
  expect(res.status()).toBe(201);
  const { id } = (await res.json()) as { id: string };

  await page.goto(`/parent/child/${id}`);
  await expect(page.getByText(/No consent is recorded for this profile/)).toBeVisible();
  await page.getByRole("button", { name: "Play now" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No consent is recorded for this child yet" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/parent/child/${id}`)); // stayed with the grown-up

  await page.getByRole("button", { name: "Open Privacy" }).click();
  await expect(page.getByText("Not given")).toBeVisible();
  await page.getByRole("button", { name: "Give consent" }).click();
  await expect(page.getByText("Not given")).toHaveCount(0);
  await page.getByRole("button", { name: "Play now" }).click();
  await expect(page).toHaveURL(/\/play$/);
});
