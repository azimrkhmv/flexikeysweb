import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin", "cyrillic"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "FlexiKeys — adaptive learning games for every child", template: "%s · FlexiKeys" },
  description:
    "FlexiKeys teaches children 3–10 letters, words, numbers and communication through calm games that quietly adapt to each child's hands, pace and needs.",
};

export const viewport: Viewport = { themeColor: "#f7f6f1", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uz" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
