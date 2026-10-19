import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B21 (spec §14): Free and Pro per family. The demo family's 7-day trial ends in 2 days (a reminder shows); on Free
// the plan's first week only and no therapist sharing; only the owner sees the trial and pay buttons.

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
});

test("the trial ends with a reminder, and the owner pays (simulated)", async ({ page }) => {
  await expect(page.getByText(/Your Pro trial ends on/)).toBeVisible();
  await page.goto("/parent/billing");
  await expect(page.getByText(/Your family is trying Pro until/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try Pro free for 7 days" })).toHaveCount(0); // once per family
  await page.getByRole("button", { name: "Pay for 1 month" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Thank you. Your family has Pro." })).toBeVisible();
  await expect(page.getByText("Your family has Pro", { exact: true })).toBeVisible();
  await page.goto("/parent");
  await expect(page.getByText(/Your Pro trial ends on/)).toHaveCount(0); // paid: no reminder
});

test("on Free: the first week of the plan, no therapist sharing; the trial opens them", async ({ page }) => {
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("fk_db_v1")!);
    db.familyPlans = []; // the demo family on Free
    localStorage.setItem("fk_db_v1", JSON.stringify(db));
  });
  await page.goto("/parent/child/ch_ali");
  await page.getByRole("button", { name: "Week 2" }).click();
  await expect(page.getByText("Weeks 2 to 4 of the plan come with Pro.")).toBeVisible();
  await page.getByRole("tab", { name: "Sharing" }).click();
  await expect(page.getByText("Sharing with a therapist is part of Pro.")).toBeVisible();
  await expect(page.getByLabel("Specialist's phone number")).toHaveCount(0);

  await page.getByRole("link", { name: "See Pro" }).click();
  await expect(page.getByText("Your family is on Free", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try Pro free for 7 days" }).click();
  await expect(page.getByText(/Your family is trying Pro until/)).toBeVisible();
  await page.goto("/parent/child/ch_ali");
  await page.getByRole("tab", { name: "Sharing" }).click();
  await expect(page.getByLabel("Specialist's phone number")).toBeVisible();
});

test("a helper sees the plan but no buttons", async ({ page }) => {
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("fk_db_v1")!);
    type Member = { familyId: string; userId: string; role: string };
    db.familyMembers = (db.familyMembers as Member[]).filter((m) => m.userId !== "u_parent2");
    db.familyMembers.push({ familyId: "fam_1", userId: "u_parent2", role: "helper" });
    localStorage.setItem("fk_db_v1", JSON.stringify(db));
  });
  await page.goto("/login");
  await page.getByLabel("Phone number").fill("+998900000006"); // Aziza, now a helper in Dilnoza's family
  await page.getByRole("button", { name: "Send the code" }).click();
  const code = (await page.getByText(/Your code is \d{6}/).innerText()).match(/\d{6}/)![0];
  await page.getByLabel("Code from the SMS").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.goto("/parent/billing");
  await expect(page.getByText(/Your family is trying Pro until/)).toBeVisible();
  await expect(page.getByText("Only the family's owner can change the plan.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay for|Try Pro/ })).toHaveCount(0);
});
