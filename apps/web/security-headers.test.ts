import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const directives = (csp: string) => Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

describe("security headers", () => {
  const prod = directives(contentSecurityPolicy(false));

  it("only this origin may provide scripts, styles, fonts, images, media and network calls", () => {
    for (const d of ["default-src", "script-src", "style-src", "img-src", "font-src", "connect-src", "media-src"])
      expect(prod[d].filter((s) => !s.startsWith("'") && !["data:", "blob:"].includes(s)), d).toEqual([]);
    expect(prod["script-src"]).not.toContain("'unsafe-eval'"); // dev only
    expect(prod["script-src"].some((s) => s.startsWith("'nonce-"))).toBe(false); // static pages by decision
  });

  it("blocks framing, plugins and base/form hijacking", () => {
    expect(prod["frame-ancestors"]).toEqual(["'none'"]);
    expect(prod["object-src"]).toEqual(["'none'"]);
    expect(prod["base-uri"]).toEqual(["'self'"]);
    expect(prod["form-action"]).toEqual(["'self'"]);
    const all = securityHeaders(false)[0].headers;
    expect(all.find((h) => h.key === "X-Frame-Options")?.value).toBe("DENY");
  });

  it("allows the microphone for our own origin only; camera, location and payment stay off", () => {
    const rules = securityHeaders(false);
    expect(rules).toHaveLength(1); // one policy for every page (per-path policies can't work in an SPA)
    const policy = rules[0].headers.find((h) => h.key === "Permissions-Policy")?.value;
    expect(policy).toBe("camera=(), microphone=(self), geolocation=(), payment=()");
  });
});
