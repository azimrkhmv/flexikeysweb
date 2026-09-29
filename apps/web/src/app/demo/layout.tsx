import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Demo", description: "Try a FlexiKeys game — nothing is saved." };

export default function DemoLayout({ children }: { children: ReactNode }) {
  return children;
}
