import type { Metadata } from "next";
import { LegalPage } from "@/features/marketing/chrome";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return <LegalPage prefix="mkt.terms" sections={7} />;
}
