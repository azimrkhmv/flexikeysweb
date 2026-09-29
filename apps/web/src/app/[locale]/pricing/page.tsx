import type { Metadata } from "next";
import { PricingPage } from "@/features/marketing/PricingPage";
import { marketingMetadata } from "@/features/marketing/seo";
import { isLang } from "@/lib/translate";

export async function generateMetadata({ params }: PageProps<"/[locale]/pricing">): Promise<Metadata> {
  const { locale } = await params;
  return isLang(locale) ? marketingMetadata(locale, "/pricing", { title: "mkt.pricing.title", description: "mkt.pricing.lead" }) : {};
}

export default function Page() {
  return <PricingPage />;
}
