import { expect, test } from "@playwright/test";
import { createAdmin, newPhone, signIn, totpCode } from "./helpers";

// B56: the admin console on the real server: the people list, the audit log and the services' health.

test("an admin sees the real users and audit log", async ({ page }) => {
  const adminPhone = `+99890${String(Date.now()).slice(-7)}`;
  const key = createAdmin(adminPhone);
  await signIn(page, adminPhone);
  await page.getByLabel("Code from the authenticator app").fill(totpCode(key));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText("Working").first()).toBeVisible(); // the database and Redis answer

  const physio = `+998${newPhone("97")}`;
  const made = await page.evaluate(async (phone) => {
    const csrf = document.cookie.split("; ").find((c) => c.startsWith("fk_csrf="))?.slice(8) ?? "";
    const headers = { "Content-Type": "application/json", "X-Auth-Transport": "cookie", "X-CSRF-Token": csrf };
    return (await fetch("/api/v1/admin/users", { method: "POST", headers, body: JSON.stringify({ phone, role: "physio" }) })).status;
  }, physio);
  expect(made).toBe(201);

  await page.goto("/admin/users");
  await page.getByPlaceholder("Search by name or phone").fill(physio.slice(4));
  await expect(page.getByRole("row").filter({ hasText: physio })).toContainText("Video reviewer");
  await page.goto("/admin/audit");
  await expect(page.getByRole("row").filter({ hasText: `phone: ${physio}` })).toContainText("user.created");
});
