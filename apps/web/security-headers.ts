// Security headers for every response (PRD SEC-3, §11.3). Used by next.config.ts, checked by security-headers.test.ts
// and e2e/security.e2e.ts. Documented in README → "Security headers".
//
// Decision (2026-09-29): keep a static CSP with 'unsafe-inline' scripts instead of per-request nonces, because
// nonces force dynamic rendering of every page in Next 16 and the public /uz /ru /en pages must stay static.
// What it still guarantees: scripts, styles, fonts, images, media and network calls only from this origin (no
// third-party scripts, analytics or ads — especially in child areas), no plugins, no <base> hijack, forms post
// only to us, and the site can't be framed (clickjacking). Revisit with SRI hashes once that is stable in Next.

export function contentSecurityPolicy(dev: boolean) {
  return [
    "default-src 'self'",
    // 'unsafe-inline': Next's inline bootstrap/RSC scripts on static pages. 'unsafe-eval' only for React dev tooling.
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

type Header = { key: string; value: string };

export function securityHeaders(dev: boolean): { source: string; headers: Header[] }[] {
  return [
    {
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy(dev) },
        { key: "X-Frame-Options", value: "DENY" }, // framing protection for browsers without frame-ancestors
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Microphone: our own origin only (parents record their voice for My Voice cards). It can't be
        // limited to /parent: the app is single-page, and a document keeps the policy of the page it
        // was first loaded on, so a parent arriving from /signup could never record. No third-party
        // scripts run here (CSP), and the browser still asks the parent for permission.
        { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
      ],
    },
  ];
}
