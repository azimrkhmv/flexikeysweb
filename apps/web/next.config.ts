import type { NextConfig } from "next";
import { securityHeaders } from "./security-headers";

const dev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone for the Docker image (PRD §29–30: Docker Compose on an Uzbek VM).
  output: "standalone",
  poweredByHeader: false,
  // CSP and other security headers: see security-headers.ts (static policy, no nonces — keeps pages static).
  async headers() {
    return securityHeaders(dev);
  },
};

export default nextConfig;
