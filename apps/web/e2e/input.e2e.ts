import { expect, test, type Page } from "@playwright/test";
import { setup } from "./helpers";

// B13: every game gets its input through the shared input layer — hold-to-choose and switch scanning work in each
// one. A short touch under the hold time is an access event (accidental tap), never a choice.

const KINDS = [
  "find_same", "listen_pick", "count", "sort", "sequence", "missing", "light_path", "path", "scene", "puzzle", "type",
  "sentence", "story", "trace", "dots", "color", "maze", "paint",
];

const input = (page: Page) => page.evaluate(() => window.fkInput ?? { accepts: [], events: [] });

for (const kind of KINDS) {
  test(`${kind}: switch scanning moves with Space and chooses with Enter`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one keyboard is enough");
    await setup(page);
    await page.goto(`/demo?access=scan&kind=${kind}`);
    await expect(page.locator("[data-fk-target]:not([disabled]):not([data-scan-skip])").first()).toBeVisible();
    const active = page.locator("[data-scan-active]");
    await expect(active).toHaveCount(1); // also when the picture loads after the first highlight
    const first = await active.getAttribute("aria-label");
    await page.keyboard.press(" "); // the second switch moves on
    await expect(active).toHaveCount(1);
    if ((await page.locator("[data-fk-target]:not([disabled]):not([data-scan-skip])").count()) > 1)
      expect(await active.getAttribute("aria-label")).not.toBe(first);
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await input(page)).accepts).toContain("switch");
  });

  test(`${kind}: hold-to-choose accepts a long hold, not a short touch`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one mouse is enough");
    await setup(page);
    await page.goto(`/demo?access=dwell&kind=${kind}`);
    const target = page.locator("[data-fk-target]:not([disabled])").first();
    await expect(target).toBeVisible();
    const box = (await target.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up(); // far shorter than the 600 ms hold
    expect((await input(page)).accepts).toEqual([]);
    await expect.poll(async () => (await input(page)).events).toContain("accidental_tap");

    await page.waitForTimeout(700); // past the double-tap guard
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    await expect.poll(async () => (await input(page)).accepts.length).toBeGreaterThan(0);
  });
}
