import type { Metadata } from "next";
import { PrivacyPolicy } from "@/features/marketing/PrivacyPolicy";
import { marketingMetadata } from "@/features/marketing/seo";
import { isLang } from "@/lib/translate";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  return isLang(locale) ? marketingMetadata(locale, "/privacy", { title: "privacy.title", description: "privacy.intro" }) : {};
}

export default function PrivacyPage() {
  return <PrivacyPolicy />;
}
