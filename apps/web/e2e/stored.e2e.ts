import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B40: the Privacy tab lists everything we store about the child in plain words; the owner deletes any one video
// or one chat, and it is gone at once.

test("the owner sees what is stored and deletes one video and one chat", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  // A feedback clip and a chat for Ali (demo data only; the clip file itself is not needed to list it).
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("fk_db_v1")!);
    const at = new Date().toISOString();
    db.consents.push({ id: "c_mv", childId: "ch_ali", scope: "movement_videos", version: "2026-09-v1", grantedBy: "u_parent", grantedAt: at });
    db.feedbackClips.push({ id: "clip_1", childId: "ch_ali", exerciseId: "E01", at });
    db.aiMessages.push(
      { id: "m1", userId: "u_parent", childId: "ch_ali", role: "user", text: "Hi", at },
      { id: "m2", userId: "u_parent", childId: "ch_ali", role: "assistant", text: "Hello", at },
    );
    localStorage.setItem("fk_db_v1", JSON.stringify(db));
  });
  await page.goto("/parent/child/ch_ali");
  await page.getByRole("tab", { name: "Privacy" }).click();

  await expect(page.getByRole("heading", { name: "Everything we store about Ali" })).toBeVisible();
  await expect(page.getByText("Videos you filmed: 1")).toBeVisible();
  await expect(page.getByText("Chats with the assistant: 1")).toBeVisible();
  await expect(page.getByText("Consents you gave:")).toBeVisible();

  await page.getByRole("button", { name: "Delete: Video of “E01”" }).click();
  await expect(page.getByText("Videos you filmed:")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Delete: Video/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Delete: Dilnoza's chat/ }).click();
  await expect(page.getByText("Chats with the assistant: 1")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Delete: Dilnoza's chat/ })).toHaveCount(0);
});
