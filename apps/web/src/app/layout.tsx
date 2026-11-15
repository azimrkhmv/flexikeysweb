import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { LiveProvider } from "@/lib/live/client";
import { SCHEME_SCRIPT } from "@/lib/scheme";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin", "cyrillic"], display: "swap" });
// Headings (B99). Fredoka has no Cyrillic letters, so Russian headings fall back to Nunito.
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "FlexiKeys — adaptive learning games for every child", template: "%s · FlexiKeys" },
  description:
    "FlexiKeys teaches children 3–10 letters, words, numbers and communication through calm games that quietly adapt to each child's hands, pace and needs.",
};

export const viewport: Viewport = { themeColor: "#fff1d6", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uz" className={`${nunito.variable} ${fredoka.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        {/* The colour scheme saved on this device, set before the first paint (B99). */}
        <script dangerouslySetInnerHTML={{ __html: SCHEME_SCRIPT }} />
        {/* Live mode: one data cache for every page (a no-op in demo mode). */}
        <LiveProvider>{children}</LiveProvider>
      </body>
    </html>
  );
}
