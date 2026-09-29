import type { Metadata } from "next";
import { LegalPage } from "@/features/marketing/chrome";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return <LegalPage prefix="mkt.privacy" sections={8} />;
}
