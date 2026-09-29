import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the public site is for search engines. Child, family and professional areas are never indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/parent", "/teacher", "/therapist", "/admin", "/play", "/class", "/dev", "/verify-email", "/reset-password"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
