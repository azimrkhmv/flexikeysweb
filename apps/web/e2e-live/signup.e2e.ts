import { expect, test, type Page } from "@playwright/test";

// B3: sign-in and sign-up against the real server (apps/api). The SMS is simulated there: the code is shown on screen.

async function signIn(page: Page, phone: string) {
  await page.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  await page.goto("/login");
  const english = page.getByRole("button", { name: "English" });
  if (await english.isVisible()) await english.click();
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Send the code" }).click();
  const note = await page.getByText(/Your code is \d{6}/).innerText();
  return note.match(/\d{6}/)![0];
}

const me = (page: Page) =>
  page.evaluate(() => fetch("/api/v1/me", { headers: { "X-Auth-Transport": "cookie" } }).then((r) => r.json()));

test("a new parent signs up: phone, code, then district and consent", async ({ page }) => {
  const phone = `93${String(Date.now()).slice(-7)}`; // a number the server has never seen
  const code = await signIn(page, phone);
  await page.getByLabel("Code from the SMS").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "A few details" })).toBeVisible();
  await page.getByLabel("Your name (optional)").fill("Dilnoza");
  await page.getByLabel("City or region").selectOption("tashkent_city");
  await page.getByLabel("District").selectOption({ index: 1 });
  await page.getByText("I agree to FlexiKeys storing").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/parent\/children\/new/);

  const user = await me(page);
  expect(user).toMatchObject({ phone: `+998${phone}`, role: "parent", name: "Dilnoza", needsSignup: false, region: "tashkent_city" });
});

test("a wrong code is refused with a clear message", async ({ page }) => {
  const code = await signIn(page, `94${String(Date.now()).slice(-7)}`);
  await page.getByLabel("Code from the SMS").fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("That code doesn't match. Check the SMS and try again.")).toBeVisible();
});
