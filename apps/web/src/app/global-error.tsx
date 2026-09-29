"use client";

import "./globals.css";
import { StatusPage } from "@/components/StatusPage";
import { Button } from "@/components/ui";
import { useLang, useT } from "@/lib/i18n";

// Replaces the root layout when it crashes, so it brings its own <html>, <body> and styles (Next 16 docs).
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [lang] = useLang();
  const t = useT();
  return (
    <html lang={lang}>
      <body>
        <title>FlexiKeys</title>
        <StatusPage mood="thinking" title={t("err.page.error.title")} body={t("err.page.error.body")}>
          <Button size="lg" onClick={() => retry()}>
            {t("common.retry")}
          </Button>
        </StatusPage>
      </body>
    </html>
  );
}
