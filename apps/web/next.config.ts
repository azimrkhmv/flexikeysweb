import type { NextConfig } from "next";
import { securityHeaders } from "./security-headers";

const dev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone for the Docker image (PRD §29–30: Docker Compose on an Uzbek VM).
  output: "standalone",
  poweredByHeader: false,
  // No floating "N" dev-tools button: it covered the sidebar's user card. Error overlays still show.
  devIndicators: false,
  // CSP and other security headers: see security-headers.ts (static policy, no nonces — keeps pages static).
  async headers() {
    return securityHeaders(dev);
  },
  // Live mode: the browser calls /api/v1 on its own origin (first-party httpOnly cookies, CSP 'self'); here it
  // is forwarded to the FastAPI backend. In production the reverse proxy (Caddy) does this (PRD §38).
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_MODE !== "live") return [];
    const origin = process.env.FK_API_ORIGIN ?? "http://localhost:8000";
    return [{ source: "/api/v1/:path*", destination: `${origin}/api/v1/:path*` }];
  },
};

export default nextConfig;
