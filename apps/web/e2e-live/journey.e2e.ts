import { expect, test } from "@playwright/test";
import { exitThroughGate } from "../e2e/helpers";

// Phase-one path on the real backend (PRD §28 core flow): sign up → consent → child → play a real activity
// → server-granted reward → adaptive session end → the parent sees progress, changes and consents.
test("parent signs up, adds a child, the child plays, the parent sees it — all on the server", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  const email = `live.${Date.now()}@example.com`;

  await page.goto("/signup");
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
  await page.getByRole("tab", { name: "My Voice" }).click();
  await expect(page.getByRole("heading", { name: "Your own cards" })).toBeVisible(); // My Voice is connected
});

// Account emails really arrive (Mailpit in e2e-live/compose.yml) and their links work once (FR-AUTH-1/3).
const MAIL = `http://localhost:${process.env.E2E_MAIL_PORT ?? 58025}`;
async function linkFor(to: string, path: "/verify-email" | "/reset-password") {
  for (let i = 0; i < 30; i++) {
    const list = (await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string }[] };
    for (const m of list.messages ?? []) {
      const text = ((await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json()) as { Text: string }).Text;
      const link = text.match(new RegExp(`http\\S+${path}\\?token=\\S+`))?.[0];
      if (link) return new URL(link).pathname + new URL(link).search; // same origin as the test server
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`no ${path} email for ${to}`);
}

test("account: verify and reset by emailed single-use links, sign out everywhere, delete the account", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  const email = `live.acct.${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Aziz");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("long-enough-password");
  await page.getByText("I agree to the Terms of use and the Privacy policy").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email$/);

  await page.goto(await linkFor(email, "/verify-email")); // the emailed link
  await expect(page.getByRole("heading", { name: "Your email is verified." })).toBeVisible();

  // Sign out everywhere, then forget the password.
  await page.goto("/parent/account");
  await page.getByRole("button", { name: "Sign out everywhere" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/a reset link is on its way/)).toBeVisible();

  const reset = await linkFor(email, "/reset-password");
  await page.goto(reset);
  await page.getByLabel("New password", { exact: true }).fill("a-brand-new-password");
  await page.getByLabel("Repeat new password").fill("a-brand-new-password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Your password was updated. You can log in now.")).toBeVisible();
  await page.goto(reset); // FR-AUTH-3: a second use fails with a friendly message
  await page.getByLabel("New password", { exact: true }).fill("yet-another-password");
  await page.getByLabel("Repeat new password").fill("yet-another-password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("This link was already used.", { exact: false })).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-brand-new-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/parent/);

  // Delete the account (typed confirmation), then the old login no longer works.
  await page.goto("/parent/account");
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByLabel("Type your email to confirm").fill(email);
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/(uz|ru|en)?$/);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-brand-new-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is not correct.")).toBeVisible();
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

async function signUp(page: import("@playwright/test").Page, name: string, email: string, role?: "Teacher" | "Therapist / specialist") {
  await page.goto("/signup");
  if (role) await page.getByText(role, { exact: true }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("long-enough-password");
  await page.getByText("I agree to the Terms of use and the Privacy policy").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
}

// School (PRD §9.15, FR-PLAY-2, FR-TCH-2/3): a teacher's class, a school profile, a shared classroom
// device that signs the child in with the class code only, progress seen by the teacher, removal.
test("teacher: class + school profile, class-code login on a shared device, progress, removal", async ({ page, browser }) => {
  await page.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  await signUp(page, "Dilnoza", `live.teacher.${Date.now()}@example.com`, "Teacher");
  await page.goto("/teacher");
  await page.getByRole("button", { name: "New class" }).click();
  await page.getByLabel("Class name").fill("Sunflowers");
  await page.getByLabel("Group or grade").fill("Preparatory group");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sunflowers" })).toBeVisible(); // opens the new class
  const code = (await page.locator(".font-mono").first().innerText()).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

  await page.getByRole("button", { name: "Add child" }).click();
  await page.getByLabel("Nickname").fill("Bek");
  await page.getByText("Our school holds signed parental consent forms for this child").click();
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("cell", { name: "Bek School profile" })).toBeVisible();

  // A classroom tablet: nobody signed in, only the class code.
  const device = await browser.newContext();
  const tablet = await device.newPage();
  await tablet.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  await tablet.goto(`/class?code=${code}`);
  await tablet.getByRole("button", { name: "Bek" }).press("Enter");
  await expect(tablet).toHaveURL(/\/play$/);
  await tablet.getByRole("button", { name: /^(Start|Boshlash)$/ }).press("Enter");
  await expect(tablet.getByRole("heading").first()).toBeVisible();
  await exitThroughGate(tablet, "en"); // the class language (English, the form's default here) is Bek's UI language
  await expect(tablet).toHaveURL(/\/class/);
  await expect(tablet.getByRole("button", { name: "Bek" })).toBeVisible(); // next child can pick (FR-TCH-2)

  // The class summary (built on the server; names never go to an AI provider).
  await page.reload();
  await page.getByRole("button", { name: "Summarize my class" }).click();
  await expect(page.getByText("Class overview: 1 children.", { exact: false })).toBeVisible();

  // The teacher removes Bek: access stops, and the device no longer offers him.
  await page.getByRole("button", { name: "Remove Bek from class" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("cell", { name: "Bek School profile" })).toHaveCount(0);
  await tablet.goto(`/class?code=${code}`);
  await expect(tablet.getByRole("button", { name: "Bek" })).toHaveCount(0);
  await device.close();
});

// Therapist (PRD §9.16, FR-THR-1, FR-PAR-2): parent invites → therapist accepts with the code → shared
// note reaches the parent → parent stops access → the therapist no longer sees the child.
test("therapist: invite, accept with the code, shared note, parent stops access", async ({ page, browser }) => {
  await page.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  await signUp(page, "Nodira", `live.par.${Date.now()}@example.com`);
  await page.goto("/parent/children/new");
  await page.getByText("Core: store my child's nickname").click();
  await page.getByText("Specialists: allow sharing with a therapist that I invite").click();
  await page.getByRole("button", { name: "I agree, continue" }).click();
  await page.getByLabel("Nickname").fill("Madina");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Madina" })).toBeVisible();
  const therapistEmail = `live.thr.${Date.now()}@example.com`;
  await page.getByRole("tab", { name: "Sharing" }).click();
  await page.getByLabel("Specialist's email").fill(therapistEmail);
  await page.getByRole("button", { name: "Invite" }).click();
  const code = (await page.getByRole("status").locator(".font-mono").innerText()).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

  const other = await browser.newContext();
  const t = await other.newPage();
  await t.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  await signUp(t, "Dr Karimova", therapistEmail, "Therapist / specialist");
  await t.goto("/therapist");
  await t.getByLabel("Invite code from a parent").fill(code);
  await t.getByRole("button", { name: "Accept" }).last().click();
  await t.getByRole("link", { name: /Madina/ }).click();
  await expect(t.getByRole("heading", { level: 1, name: "Madina" })).toBeVisible();
  await t.getByPlaceholder("Observations, what helped, what to try next…").fill("Big keys help a lot");
  // "Visible to parent" is on by default.
  await t.getByRole("button", { name: "Save" }).first().click();
  await expect(t.getByText("Big keys help a lot")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /^Notifications \(2\)/ }).click(); // the bell (PRD §9.14)
  await expect(page.getByText("A specialist accepted the invite for Madina")).toBeVisible();
  await expect(page.getByText("New specialist note about Madina")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Sharing" }).click();
  await expect(page.getByText("Big keys help a lot")).toBeVisible(); // the shared note
  await page.getByRole("listitem").filter({ hasText: "Has access" }).getByRole("button", { name: "Stop access" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Stop access" }).click();
  await expect(page.getByText("Has access")).toHaveCount(0);

  await t.goto("/therapist");
  await expect(t.getByRole("link", { name: /Madina/ })).toHaveCount(0); // FR-PAR-2
  await other.close();
});

// My Voice (PRD §9.11, FR-AAC-2): the parent's own card reaches the child's device through the server,
// the child speaks a sentence, and the parent's dashboard shows it.
test("My Voice: parent's own card on the child's device, the spoken sentence on the dashboard", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  await signUp(page, "Sevara", `live.aac.${Date.now()}@example.com`);
  await page.goto("/parent/children/new");
  await page.getByText("Core: store my child's nickname").click();
  await page.getByRole("button", { name: "I agree, continue" }).click();
  await page.getByLabel("Nickname").fill("Timur");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Timur" })).toBeVisible();

  await page.getByRole("tab", { name: "My Voice" }).click();
  await page.getByLabel("Word on the card").fill("Mosh");
  await page.getByRole("button", { name: "Add card" }).click();
  await expect(page.getByText("Mosh").first()).toBeVisible();

  await page.getByRole("button", { name: "Play now" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole("button", { name: "Start" }).press("Enter");
  const voice = page.getByRole("button", { name: "My Voice" });
  for (let i = 0; i < 4 && !(await voice.isVisible()); i++) await page.getByRole("button", { name: "Back" }).press("Enter");
  await voice.press("Enter");
  await page.getByRole("button", { name: "People" }).press("Enter"); // the card's category
  await page.getByRole("button", { name: "Mosh" }).press("Enter"); // the parent's card, from the server
  await page.getByRole("button", { name: "Speak" }).press("Enter");
  await page.waitForTimeout(500);
  await exitThroughGate(page, "en");

  await page.getByRole("link", { name: /Timur/ }).click();
  await page.getByRole("tab", { name: "My Voice" }).click();
  await expect(page.getByText("“Mosh”")).toBeVisible(); // recent sentences
});

// Assistant (PRD §16): only with the AI consent; with no AI provider configured it answers from the
// child's own aggregated data, in the parent's language; the conversation is the child's own.
test("assistant: answers from the child's own data, and the conversation can be deleted", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  await signUp(page, "Kamola", `live.ai.${Date.now()}@example.com`);
  await page.goto("/parent/children/new");
  await page.getByText("Core: store my child's nickname").click();
  await page.getByText("AI help: send anonymous").click();
  await page.getByRole("button", { name: "I agree, continue" }).click();
  await page.getByLabel("Nickname").fill("Aziz");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Aziz" })).toBeVisible();

  await page.goto("/parent/assistant");
  await page.getByLabel("Type your question").fill("What should we practise at home?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/This week your child played about \d+ minutes/)).toBeVisible();
  await page.reload(); // the conversation is on the server
  await expect(page.getByText("What should we practise at home?")).toBeVisible();
  await page.getByRole("button", { name: "Delete conversation" }).click();
  await expect(page.getByText("What should we practise at home?")).toHaveCount(0);
});

// Billing (PRD §9.18, FR-BILL-1/3): checkout goes to Payme; the provider confirms server-to-server
// (played here by the test, with the stack's throwaway merchant key); back on the page the plan is on.
test("billing: Payme checkout, server-to-server confirmation, the family plan opens all levels", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  await signUp(page, "Rustam", `live.bill.${Date.now()}@example.com`);
  await page.goto("/parent/children/new");
  await page.getByText("Core: store my child's nickname").click();
  await page.getByRole("button", { name: "I agree, continue" }).click();
  await page.getByLabel("Nickname").fill("Lola");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lola" })).toBeVisible();

  // The provider's page: we only need the URL Payme would be opened with.
  let checkout = "";
  await page.route("https://checkout.test.paycom.uz/**", (r) => {
    checkout = r.request().url();
    return r.fulfill({ contentType: "text/html", body: "<h1>Payme (test)</h1>" });
  });
  await page.goto("/parent/billing");
  await page.getByRole("radio", { name: /month/i }).click();
  await page.getByRole("button", { name: "Pay with Payme" }).click();
  await expect(page.getByRole("heading", { name: "Payme (test)" })).toBeVisible();
  const params = Buffer.from(checkout.split("/").pop()!, "base64").toString();
  const order = params.match(/ac\.order_id=([0-9a-f-]+)/)![1];
  const amount = Number(params.match(/;a=(\d+)/)![1]);
  expect(amount).toBe(4_900_000); // the server's price, in tiyin

  // Payme → our merchant endpoint (Basic auth with the merchant key).
  const api = `${process.env.FK_API_ORIGIN ?? "http://localhost:58000"}/api/v1/billing/payme`;
  const rpc = (method: string, params: object) =>
    fetch(api, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from("Paycom:e2e-payme-key").toString("base64")}` }, body: JSON.stringify({ id: 1, method, params }) }).then((r) => r.json());
  expect((await rpc("CreateTransaction", { id: `pm-${order}`, time: Date.now(), amount, account: { order_id: order } })).result.state).toBe(1);
  expect((await rpc("PerformTransaction", { id: `pm-${order}` })).result.state).toBe(2);
  expect((await rpc("PerformTransaction", { id: `pm-${order}` })).result.state).toBe(2); // repeated: same answer (FR-BILL-1)

  await page.goto(`/parent/billing?order=${order}`); // the provider's return URL
  await expect(page.getByText("Payment received — thank you! All levels are open.").first()).toBeVisible();
  await expect(page.getByText(/Lola: full access/i)).toBeVisible();
});
