import { expect, test, type Page } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B27: the owner invites a second adult by phone; the helper accepts and sees the child, but never the consent,
// sharing, delete or pay buttons; the owner removes them and the child is gone from their list at once.

const HELPER = "+998901112233";

async function signInWithPhone(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Send the code" }).click();
  const code = (await page.getByText(/Your code is \d{6}/).innerText()).match(/\d{6}/)![0];
  await page.getByLabel("Code from the SMS").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
}

test("a helper does daily use only, and removal cuts access", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.getByLabel("Their phone number").fill(HELPER);
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(page.getByText("+998901112233 · waiting to accept")).toBeVisible();

  await signInWithPhone(page, HELPER); // a new number: the details step first
  await expect(page.getByRole("heading", { name: "A few details" })).toBeVisible();
  await page.getByLabel("District").selectOption({ index: 1 });
  await page.getByText("I agree to FlexiKeys storing").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.goto("/parent");
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByRole("link", { name: /Ali/ }).first()).toBeVisible();
  await page.goto("/parent/child/ch_ali");
  await expect(page.getByRole("tab", { name: "Plan" })).toBeVisible();
  for (const owner of ["Sharing", "Settings", "Privacy"]) await expect(page.getByRole("tab", { name: owner })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Delete/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Pay|Upgrade/ })).toHaveCount(0);

  await loginAs(page, "Parent");
  await page.getByRole("button", { name: "Remove" }).click();
  await signInWithPhone(page, HELPER);
  await page.goto("/parent/child/ch_ali");
  await expect(page.getByText("Not found.")).toBeVisible();
});
