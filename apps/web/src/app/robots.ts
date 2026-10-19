import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the public site is for search engines. Child, family and professional areas are never indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/parent", "/therapist", "/physio", "/admin", "/play", "/dev"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
