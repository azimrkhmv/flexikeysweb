import { expect, test } from "@playwright/test";
import { childStep, createAdmin, newPhone, serverCommand, signIn, signUp, totpCode } from "./helpers";

// B39: a Home Kit order placed in the browser appears for the admin, who confirms it (the real server).

test("a Home Kit order placed in the browser appears for the admin", async ({ page, browser }) => {
  test.setTimeout(120_000);
  serverCommand("load-kits");
  await signUp(page, newPhone("91"));
  await childStep(page, "Aziz");
  await page.goto("/parent/kit");
  const order = page.getByRole("button", { name: "Order the Home Kit" });
  await page.getByLabel("City or region").selectOption("tashkent_city");
  await page.getByLabel("District").selectOption("Chilonzor");
  const street = `Bunyodkor ${Date.now() % 100000}`;
  await page.getByLabel("Street, house, flat").fill(street);
  await expect(order).toBeDisabled(); // the allergy question first
  await page.getByLabel("No", { exact: true }).check();
  await order.click();
  await expect(page.getByRole("status").filter({ hasText: "Our team will call you" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: street })).toContainText("Ordered");

  const adminPhone = `+99890${String(Date.now()).slice(-7)}`;
  const key = createAdmin(adminPhone);
  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, adminPhone);
  await admin.getByLabel("Code from the authenticator app").fill(totpCode(key));
  await admin.getByRole("button", { name: "Continue" }).click();
  await expect(admin).toHaveURL(/\/admin/);
  await admin.goto("/admin/kits");
  const row = admin.getByRole("row").filter({ hasText: street });
  await expect(row).toContainText("Ordered");
  await row.getByRole("button", { name: "Confirm" }).click();
  await expect(row).toContainText("Confirmed");

  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: street })).toContainText("Confirmed");
});
