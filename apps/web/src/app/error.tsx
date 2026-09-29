"use client";

import { useEffect } from "react";
import { StatusPage } from "@/components/StatusPage";
import { Button, LinkButton } from "@/components/ui";
import { useT } from "@/lib/i18n";

// Route-level crash screen for adult areas (child mode has its own, text-free one in play/error.tsx).
export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  useEffect(() => console.error("[route-error]", error.digest ?? error), [error]);
  return (
    <StatusPage mood="thinking" title={t("err.page.error.title")} body={t("err.page.error.body")}>
      <Button size="lg" onClick={() => retry()}>
        {t("common.retry")}
      </Button>
      <LinkButton href="/" size="lg" variant="outline">
        {t("err.page.home")}
      </LinkButton>
    </StatusPage>
  );
}
