import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B31 (spec §12): the therapist sees the family's assistant chats only as topics and warnings, never the chat.
test("the therapist sees topics and warnings, never the family's chat", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/assistant");
  const box = page.getByLabel("Type your question");
  for (const text of ["Ali gets tired after the putty, my secret worry", "He had a seizure this morning"]) {
    await box.fill(text);
    await box.press("Enter");
    await expect(page.getByText(text)).toBeVisible();
    await expect(page.getByText("Thinking…")).toHaveCount(0); // the answer came
  }

  await loginAs(page, "Therapist");
  await page.goto("/therapist/child/ch_ali");
  await expect(page.getByText("Questions asked: 2")).toBeVisible();
  const topics = page.getByRole("list", { name: "What the family asked the assistant" });
  await expect(topics.getByText("Child refuses or is tired · 1")).toBeVisible();
  await expect(topics.getByText("Home Kit tools · 1")).toBeVisible();
  await expect(page.getByText("Emergency words: the assistant showed 103")).toBeVisible();
  await expect(page.getByText("my secret worry")).toHaveCount(0);
  await expect(page.getByText("seizure this morning")).toHaveCount(0);

  // The therapist's own chat about the child, kept apart from the family's summary.
  await page.getByLabel("Type your question").fill("What is next in the plan?");
  await page.getByLabel("Type your question").press("Enter");
  await expect(page.getByText("What is next in the plan?")).toBeVisible();
  await expect(page.getByText("Questions asked: 2")).toBeVisible();
});
