import type { Metadata } from "next";
import { LegalPage } from "@/features/marketing/chrome";
import { marketingMetadata } from "@/features/marketing/seo";
import { isLang } from "@/lib/translate";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  return isLang(locale) ? marketingMetadata(locale, "/privacy", { title: "mkt.privacy.title", description: "mkt.privacy.intro" }) : {};
}

export default function PrivacyPage() {
  return <LegalPage prefix="mkt.privacy" sections={8} />;
}
