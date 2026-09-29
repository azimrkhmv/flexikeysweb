import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

// Developer gallery: available in development, and in production only when FK_DEV_PAGES=1 at build time.
export default function DesignLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.FK_DEV_PAGES !== "1") notFound();
  return children;
}
