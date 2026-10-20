import { expect, test } from "@playwright/test";
import { childStep, newPhone, signUp } from "./helpers";

// B33: the assistant screen talks to the real server. A question gets an answer from the server's AI (the pretend
// one without OPENROUTER_API_KEY); emergency words get 103 first; the chat is kept after a reload.

test("a question gets an answer from the server, and the chat is kept", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page, newPhone("98"));
  await childStep(page, "Malika");
  await page.goto("/parent/assistant");
  const box = page.getByLabel("Type your question");
  const answers = page.locator("main p.rounded-bl-lg"); // the assistant's bubbles

  await box.fill("How long should we play today?");
  await box.press("Enter");
  await expect(answers).toHaveCount(1, { timeout: 60_000 });
  await expect(answers.first()).not.toBeEmpty();

  await box.fill("Bolada tutqanoq boʻldi");
  await box.press("Enter");
  await expect(page.getByRole("alert").getByRole("link", { name: "Call 103" })).toHaveAttribute("href", "tel:103");

  await page.reload();
  await expect(page.getByText("How long should we play today?")).toBeVisible();
  await expect(answers).toHaveCount(1);
  await expect(page.getByRole("alert").filter({ hasText: "103" })).toHaveCount(1);
});
