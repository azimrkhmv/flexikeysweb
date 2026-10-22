import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B23: the therapist form T1–T11. The required answers follow the therapist's profession (spec §6).
test("the required answers follow the profession", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Therapist");
  await page.goto("/therapist/child/ch_ali");
  await expect(page.getByText("Fill in your profile first")).toBeVisible();

  await page.goto("/therapist");
  await page.getByLabel("Your name").fill("Dilnoza Karimova");
  await page.getByLabel("Profession").selectOption("physio");
  await page.getByLabel("Workplace").fill("Clinic 1");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Physiotherapist / LFK specialist · Clinic 1")).toBeVisible();

  await page.goto("/therapist/child/ch_ali");
  const form = page.locator("form:has([data-question])");
  const required = (id: string) => page.locator(`[data-question="${id}"]`).getByText("Required", { exact: true });
  await expect(required("T3")).toBeVisible();
  await expect(required("T4")).toHaveCount(0);
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Some required answers are still empty.")).toBeVisible();
  await expect(page.locator('[data-question="T3"]').getByRole("alert")).toBeVisible();

  await page.getByLabel("Gross motor level (GMFCS)").selectOption("3");
  await page.getByLabel("Hand use level (MACS)").selectOption("2");
  await page.getByRole("checkbox", { name: "No jumping" }).check();
  await page.getByRole("checkbox", { name: "Sit better" }).check();
  await page.getByLabel("Message to the parent").fill("Keep going!");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved. The plan was updated.")).toBeVisible(); // Ali has a plan: a new level rebuilds it
  await page.reload();
  await expect(page.getByLabel("Message to the parent")).toHaveValue("Keep going!");

  // A speech therapist must give the communication level instead of the hand level.
  await page.goto("/therapist");
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("Profession").selectOption("speech");
  await page.getByRole("button", { name: "Save" }).click();
  await page.goto("/therapist/child/ch_ali");
  await expect(required("T4")).toBeVisible();
  await expect(required("T3")).toHaveCount(0);
});

// B24: the parent sees whose answer is in use, and the therapist's message.
test("the parent sees the therapist's updates and message", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Therapist");
  await page.goto("/therapist");
  await page.getByLabel("Your name").fill("Dilnoza Karimova");
  await page.getByLabel("Profession").selectOption("neurologist");
  await page.getByLabel("Workplace").fill("Clinic 1");
  await page.getByRole("button", { name: "Save" }).click();
  await page.goto("/therapist/child/ch_ali");
  // B58: why each item of Ali's plan is there (the demo's plans are the rules' own picks).
  await expect(page.getByRole("heading", { name: "Why this plan" })).toBeVisible();
  await expect(page.getByText("The fixed rules chose these items for the child's goals and level.")).toBeVisible();
  const form = page.locator("form:has([data-question])");
  await page.getByLabel("Gross motor level (GMFCS)").selectOption("3");
  await page.getByRole("checkbox", { name: "No jumping" }).check();
  await page.getByRole("checkbox", { name: "Sit better" }).check();
  await page.getByLabel("Message to the parent").fill("Ali did well this week.");
  await page.getByLabel(/GMFM total score/).fill("47.5"); // IQ6: section L, for therapists only
  await page.getByRole("group", { name: /SATCo\), static/ }).getByText("Mid chest", { exact: true }).click();
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved. The plan was updated.")).toBeVisible(); // Ali has a plan: a new level rebuilds it

  await loginAs(page, "Parent");
  await page.goto("/parent/child/ch_ali");
  const card = page.locator("section, div").filter({ has: page.getByRole("heading", { name: "From Ali's therapist" }) }).last();
  await expect(card.getByRole("heading", { name: "From Ali's therapist" })).toBeVisible();
  await expect(card.getByText("Updated by Dilnoza Karimova, Neurologist").first()).toBeVisible();
  await expect(card.getByText("Walks with a walker or with hands held")).toBeVisible();
  await expect(card.getByText("Ali did well this week.")).toBeVisible();
  await expect(page.getByText("47.5")).toHaveCount(0); // the GMFM score never reaches the parent (rule 1)
  await expect(page.getByText("GMFM")).toHaveCount(0);
});

// B25: an exercise the therapist excludes never comes back into the plan.
test("an excluded exercise leaves the plan", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/child/ch_ali");
  const exercises = page.locator("li li.text-sm");
  const title = (await exercises.first().innerText()).split("\n")[0].trim();
  expect(title).not.toBe("");

  await loginAs(page, "Therapist");
  await page.goto("/therapist");
  await page.getByLabel("Your name").fill("Dilnoza Karimova");
  await page.getByLabel("Profession").selectOption("neurologist");
  await page.getByLabel("Workplace").fill("Clinic 1");
  await page.getByRole("button", { name: "Save" }).click();
  await page.goto("/therapist/child/ch_ali");
  const form = page.locator("form:has([data-question])");
  await page.getByLabel("Gross motor level (GMFCS)").selectOption("2");
  await page.getByRole("checkbox", { name: "Nothing" }).check();
  await page.getByRole("checkbox", { name: "Use hands better" }).check();
  await form.getByRole("combobox", { name: title, exact: true }).selectOption("exclude");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved. The plan was updated.")).toBeVisible();

  await loginAs(page, "Parent");
  await page.goto("/parent/child/ch_ali");
  for (const week of [1, 2, 3, 4]) {
    await page.getByRole("button", { name: `Week ${week}` }).click();
    await expect(exercises.filter({ hasText: title })).toHaveCount(0);
  }
});

// B29: a feedback clip filmed on Today shows on the therapist's child page with its exercise name.
test("a feedback clip from Today reaches the therapist", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/child/ch_ali#privacy");
  await page.reload();
  await page.getByRole("switch", { name: /^Movement videos/ }).click();
  await page.goto("/parent");
  const item = page.locator("li").filter({ has: page.getByRole("button", { name: "Done", exact: true }) }).first();
  const title = (await item.locator("p.font-extrabold").innerText()).trim();
  await item.getByRole("button", { name: "Done", exact: true }).click();
  const done = page.locator("li").filter({ hasText: title }).first();
  await done.getByLabel("Film it for the therapist (optional)").setInputFiles({ name: "clip.mp4", mimeType: "video/mp4", buffer: Buffer.from("pretend clip") });
  await expect(done.getByText("Video sent to the therapist")).toBeVisible();

  await loginAs(page, "Therapist");
  await page.goto("/therapist/child/ch_ali");
  await expect(page.getByText(`Exercise: ${title}`, { exact: true })).toBeVisible();
});

// B30: a new number opens the parent's invite link, signs in, and sees the child without typing a code.
test("a therapist link signs a new number straight into the share", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/child/ch_madina#privacy");
  await page.reload();
  await page.getByRole("switch", { name: "Specialists: allow sharing with a therapist that I invite" }).click();
  await page.getByRole("tab", { name: "Sharing" }).click();
  await page.getByRole("button", { name: "Invite" }).click(); // no phone: a link
  const code = (await page.getByRole("status").locator(".font-mono").innerText()).trim();
  await expect(page.getByRole("link", { name: "Send by Telegram" })).toHaveAttribute("href", new RegExp(`login%3Finvite%3D${code}`));

  await page.goto(`/login?invite=${code}`);
  await page.getByLabel("Phone number").fill("+998901234599");
  await page.getByRole("button", { name: "Send the code" }).click();
  const sms = (await page.getByText(/Your code is \d{6}/).innerText()).match(/\d{6}/)![0];
  await page.getByLabel("Code from the SMS").fill(sms);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/therapist/);
  await expect(page.getByRole("link", { name: /Madina/ })).toBeVisible();
});
