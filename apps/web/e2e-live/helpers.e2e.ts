import { expect, test } from "@playwright/test";
import { childStep, newPhone, signUp } from "./helpers";

// B28: the owner invites a second adult by phone; the helper signs in with their own phone, accepts, and sees the
// family's child (daily use only); the owner removes them and the child is gone at once.

test("a helper signs in with their own phone and sees the family's child", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const helperPhone = newPhone("95");
  await signUp(page, newPhone("98"));
  const child = await childStep(page, "Aziz");
  await page.goto("/parent");
  await page.getByLabel("Their phone number").fill(helperPhone);
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(page.getByText(`+998${helperPhone} · waiting to accept`)).toBeVisible();

  const other = await browser.newContext();
  const helper = await other.newPage();
  await signUp(helper, helperPhone);
  await helper.goto("/parent");
  await helper.getByRole("button", { name: "Accept" }).click();
  await expect(helper.getByRole("link", { name: /Aziz/ }).first()).toBeVisible();
  await helper.goto(`/parent/child/${child}`);
  await expect(helper.getByRole("tab", { name: "Plan" })).toBeVisible();
  for (const owner of ["Sharing", "Settings", "Privacy"]) await expect(helper.getByRole("tab", { name: owner })).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await helper.goto(`/parent/child/${child}`);
  await expect(helper.getByText("Not found.")).toBeVisible();
  await other.close();
});
