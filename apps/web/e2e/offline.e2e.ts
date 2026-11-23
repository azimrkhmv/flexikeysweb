import { expect, test, type Page } from "@playwright/test";
import { birthDate, setup } from "./helpers";

// B120 (Update 4 spec 9): the connection drops halfway through the questionnaire. No answer is lost (it stays on the
// phone), the parent sees the offline message, Next waits, and the answers are sent when the connection returns.

const pick = (page: Page, question: string | RegExp, option: string) => page.getByRole("group", { name: question }).getByText(option, { exact: true }).click();

/** The answers the (demo) server holds for this child. */
const stored = (page: Page, name: string) =>
  page.evaluate((n) => {
    const db = JSON.parse(localStorage.getItem("fk_db_v1")!);
    const kid = db.children.find((c: { name: string }) => c.name === n);
    return kid ? db.intakeAnswers.filter((a: { childId: string }) => a.childId === kid.id).map((a: { questionId: string }) => a.questionId) : [];
  }, name);

test("offline halfway through the questionnaire: nothing is lost, and it is sent when the connection returns", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "one journey is enough");
  await setup(page);
  await page.goto("/signup");
  await page.getByLabel("Phone number").fill("+998 93 555 40 19");
  await page.getByRole("button", { name: "Send the code" }).click();
  const code = (await page.getByText(/Your code is \d{6}/).innerText()).match(/\d{6}/)![0];
  await page.getByLabel("Code from the SMS").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("City or region").selectOption("tashkent_city");
  await page.getByLabel("District").selectOption("Yunusobod");
  await page.getByText("I agree to the Privacy policy").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/parent\/children\/new/);
  await page.goto("/parent/children/new?q=2026-10-16");

  // Section 1 online: the child is made.
  await page.getByLabel(/What is your child's name/).fill("Dilfuza");
  await birthDate(page, "2018-03-01");
  await pick(page, "Boy or girl?", "Girl");
  await page.getByLabel("Height (cm)").fill("120");
  await page.getByLabel("Weight (kg)").fill("22");
  await pick(page, "Who is filling this in?", "Mother");
  await pick(page, /^Languages you speak with your child at home/, "Uzbek");
  await pick(page, "How many adults can help with exercises at home?", "Only me");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "I agree — continue" }).click();
  const section = page.getByRole("heading", { level: 1, name: "Diagnosis and medical history" });
  await expect(section).toBeVisible();

  // The connection drops.
  await context.setOffline(true);
  await expect(page.getByText("You are offline — your answers are kept on this phone")).toBeVisible();
  await pick(page, /given your child a diagnosis/, "Developmental delay");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(section).toBeVisible(); // Next waits
  expect(await stored(page, "Dilfuza")).not.toContain("B1"); // not sent yet ...
  const draft = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("fk-q-draft:")).map((k) => JSON.parse(localStorage.getItem(k)!)));
  expect(draft.some((d) => "B1" in d && d.A1 === "Dilfuza")).toBe(true); // ... but kept on the phone

  // Back online: sent at once, and the parent is told.
  await context.setOffline(false);
  await expect(page.getByText("Back online — saved")).toBeVisible();
  await expect.poll(() => stored(page, "Dilfuza")).toContain("B1");
  await expect(page.getByText("You are offline — your answers are kept on this phone")).toHaveCount(0);
});
