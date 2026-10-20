import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { childStep, newPhone, signUp } from "./helpers";

// B41: "Everything we store" against the real server: the parent downloads the child's data, deletes a chat, and
// deletes the child.

test("a parent downloads the child's data, deletes a chat and deletes the child", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page, newPhone("98"));
  const child = await childStep(page, "Malika");
  await page.goto("/parent/assistant");
  await page.getByLabel("Type your question").fill("How long should we play today?");
  await page.getByLabel("Type your question").press("Enter");
  await expect(page.locator("main p.rounded-bl-lg")).toHaveCount(1, { timeout: 60_000 });

  await page.goto(`/parent/child/${child}#privacy`);
  await page.reload();
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download (JSON)" }).click();
  const file = await (await waiting).path();
  const data = JSON.parse(readFileSync(file, "utf8"));
  expect(data.child.name).toBe("Malika");
  expect(Object.keys(data.tables)).toContain("chats");

  const chat = page.getByRole("button", { name: /^Delete: .*chat/ });
  await expect(chat).toHaveCount(1);
  await chat.click();
  await expect(chat).toHaveCount(0);
  await page.goto("/parent/assistant");
  await expect(page.getByText("How long should we play today?")).toHaveCount(0);

  await page.goto(`/parent/child/${child}#privacy`);
  await page.reload();
  await page.getByRole("button", { name: "Delete Malika's profile" }).click();
  await page.getByLabel("Type “Malika” to confirm").fill("Malika");
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/parent$/);
  await expect(page.getByText("Malika")).toHaveCount(0);
});
