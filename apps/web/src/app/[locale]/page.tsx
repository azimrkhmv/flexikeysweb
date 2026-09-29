import type { Metadata } from "next";
import { HomePage } from "@/features/marketing/HomePage";
import { marketingMetadata } from "@/features/marketing/seo";
import { isLang } from "@/lib/translate";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return isLang(locale) ? marketingMetadata(locale, "", { description: "mkt.hero.lead" }) : {};
}

export default function Page() {
  return <HomePage />;
}
