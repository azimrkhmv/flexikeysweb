import { expect, test } from "@playwright/test";
import { setup } from "./helpers";

// Static CSP (decision: no per-request nonces so public pages stay static) — verify it does its job.
test.describe("security headers", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop"));

  test("every kind of page carries the policy (static public, app, child mode)", async ({ request }) => {
    for (const path of ["/uz", "/ru/pricing", "/login", "/parent", "/play"]) {
      const h = (await request.get(path)).headers();
      const csp = h["content-security-policy"];
      expect(csp, path).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp, path).not.toContain("unsafe-eval");
      expect(csp, path).toContain("frame-ancestors 'none'");
      expect(csp, path).toContain("object-src 'none'");
      expect(h["x-frame-options"], path).toBe("DENY");
      expect(h["x-powered-by"], path).toBeUndefined();
    }
    expect((await request.get("/parent")).headers()["permissions-policy"]).toContain("microphone=(self)");
    expect((await request.get("/play")).headers()["permissions-policy"]).toContain("microphone=()");
  });

  test("the site cannot be framed (clickjacking)", async ({ page, baseURL }) => {
    await page.setContent(`<iframe src="${baseURL}/en" width="400" height="300"></iframe>`);
    const frame = page.frames()[1];
    await expect.poll(() => frame.url()).toMatch(/^chrome-error:/);
  });

  test("third-party scripts and network calls are blocked", async ({ page }) => {
    await setup(page);
    await page.goto("/en");
    const result = await page.evaluate(
      () =>
        new Promise<{ violated: string; ran: boolean; fetchBlocked: boolean }>((resolve) => {
          document.addEventListener("securitypolicyviolation", async (e) => {
            const fetchBlocked = await fetch("https://example.com/collect").then(() => false, () => true);
            resolve({ violated: e.violatedDirective, ran: "__thirdParty" in window, fetchBlocked });
          }, { once: true });
          const s = document.createElement("script");
          s.src = "https://cdn.example.com/tracker.js";
          document.head.appendChild(s);
        }),
    );
    expect(result.violated).toMatch(/^script-src/);
    expect(result.ran).toBe(false);
    expect(result.fetchBlocked).toBe(true);
  });
});
