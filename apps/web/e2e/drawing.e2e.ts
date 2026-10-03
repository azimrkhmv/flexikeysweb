import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yIssues, loginAs, setup } from "./helpers";

// Drawing activities (PRD §9.7, Flutter parity): each one can be finished by tapping alone, and finishing
// one is rewarded by the (mock) server like any other activity.

async function openActivity(page: Page, level: string, kind: string) {
  const map = page.getByRole("heading", { name: "Where shall we go?" });
  for (let i = 0; i < 4 && !(await map.isVisible()); i++) await page.getByRole("button", { name: /^(Back|Map)$/ }).first().press("Enter");
  await page.getByRole("button", { name: level, exact: true }).first().press("Enter");
  await page.getByRole("button", { name: kind, exact: true }).press("Enter");
}

async function celebrate(page: Page) {
  await expect(page.getByRole("heading", { name: "You did it! Great effort." })).toBeVisible();
  await expect(page.getByText(/⭐ \+\d/)).toBeVisible();
}

/** Taps the glowing next dot until the round is solved, for every round. */
async function tapAllDots(page: Page) {
  for (let guard = 0; guard < 200; guard++) {
    const done = page.getByRole("button", { name: "Done", exact: true });
    if (await done.isVisible()) return done.press("Enter");
    const next = page.getByRole("button", { name: "Next", exact: true });
    if (await next.isVisible()) {
      await next.press("Enter");
      continue;
    }
    await page.getByRole("button", { name: /^Dot \d+$/ }).press("Enter");
  }
  throw new Error("dots never finished");
}

/** Right-hand wall follower: always reaches the goal of a perfect maze, using only the offered moves. */
async function solveMaze(page: Page) {
  type Dir = "Up" | "Right" | "Down" | "Left";
  const turn: Record<Dir, Dir[]> = { Up: ["Right", "Up", "Left", "Down"], Right: ["Down", "Right", "Up", "Left"], Down: ["Left", "Down", "Right", "Up"], Left: ["Up", "Left", "Down", "Right"] };
  let heading: Dir = "Right";
  for (let step = 0; step < 200; step++) {
    if (await page.getByRole("button", { name: /^(Next|Done)$/ }).isVisible()) return;
    const options: Dir[] = turn[heading];
    for (const dir of options) {
      const b = page.getByRole("button", { name: dir, exact: true });
      if (await b.isVisible()) {
        await b.press("Enter");
        heading = dir;
        break;
      }
    }
  }
  throw new Error("maze never solved");
}

test("drawing activities: trace, connect the dots, paint, coloring and maze can all be finished by tapping", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one viewport is enough for the flow");
  test.setTimeout(120_000);
  await setup(page);
  await loginAs(page, "Parent");
  // Open Ali's levels 7–9 so the Toys maze is reachable, in English (demo data only).
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("fk_db_v1")!);
    for (const levelId of ["fruits", "vegetables"]) {
      const lv = { fruits: ["fruits-same", "fruits-sort", "fruits-type"], vegetables: ["veg-listen", "veg-sort", "veg-missing"] }[levelId]!;
      db.progress = db.progress.filter((p: { childId: string; levelId: string }) => !(p.childId === "ch_ali" && p.levelId === levelId));
      db.progress.push({ childId: "ch_ali", levelId, completed: lv, stars: 9 });
    }
    const ali = db.children.find((c: { id: string }) => c.id === "ch_ali");
    Object.assign(ali, { uiLang: "en", learningLang: "en" }); // English copy in the assertions below
    localStorage.setItem("fk_db_v1", JSON.stringify(db));
  });
  await page.goto("/play");
  await page.getByRole("button", { name: "Ali" }).press("Enter");
  await page.getByRole("button", { name: "Start" }).press("Enter");

  await openActivity(page, "Letters", "Draw");
  await expect(page.getByRole("heading", { name: "Draw A along the dots" })).toBeVisible();
  await expectNoA11yIssues(page, "trace");
  await tapAllDots(page);
  await celebrate(page);

  await openActivity(page, "Shapes", "Connect the dots");
  await tapAllDots(page);
  await celebrate(page);

  await openActivity(page, "Colors", "Painting");
  await expect(page.getByRole("button", { name: "Done", exact: true })).toHaveCount(0); // a few marks first
  await page.getByRole("button", { name: "Paint for me" }).press("Enter");
  await page.getByRole("button", { name: "Done", exact: true }).press("Enter");
  await celebrate(page);

  await openActivity(page, "Animals", "Coloring");
  await page.getByRole("button", { name: "Cat" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Color the Cat" })).toBeVisible();
  await page.getByRole("button", { name: "blue" }).press("Enter");
  await page.getByRole("button", { name: "Paint for me" }).press("Enter");
  await page.getByRole("button", { name: "Done", exact: true }).press("Enter");
  await celebrate(page);

  await openActivity(page, "Toys", "Maze");
  for (let round = 0; round < 2; round++) {
    await solveMaze(page);
    await page.getByRole("button", { name: /^(Next|Done)$/ }).press("Enter");
  }
  await celebrate(page);
});
