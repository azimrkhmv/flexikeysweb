import type { ReactNode } from "react";
import { Footer, Header } from "@/features/marketing/chrome";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
