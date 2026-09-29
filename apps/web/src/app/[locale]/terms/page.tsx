import type { Metadata } from "next";
import { LegalPage } from "@/features/marketing/chrome";
import { marketingMetadata } from "@/features/marketing/seo";
import { isLang } from "@/lib/translate";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  return isLang(locale) ? marketingMetadata(locale, "/terms", { title: "mkt.terms.title", description: "mkt.terms.intro" }) : {};
}

export default function TermsPage() {
  return <LegalPage prefix="mkt.terms" sections={7} />;
}
