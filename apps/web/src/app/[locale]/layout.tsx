import { notFound } from "next/navigation";
import "@/messages/public";
import { Footer, Header } from "@/features/marketing/chrome";
import { RouteLangProvider } from "@/lib/i18n";
import { isLang, LANGS } from "@/lib/translate";

// Public site in /uz, /ru, /en (PRD §9.19). The URL sets the language, so each page is server-rendered and
// indexable in that language; any other first segment is a 404 (notFound below). App areas (/parent, /play…) stay unprefixed.
export const generateStaticParams = () => LANGS.map((locale) => ({ locale }));

export default async function MarketingLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLang(locale)) notFound();
  return (
    <RouteLangProvider lang={locale}>
      {/* The root <html lang> is shared by all areas; this marks the whole public page's language. */}
      <div lang={locale}>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </div>
    </RouteLangProvider>
  );
}
