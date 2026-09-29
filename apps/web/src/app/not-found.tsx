"use client";

import { StatusPage } from "@/components/StatusPage";
import { LinkButton } from "@/components/ui";
import { useT } from "@/lib/i18n";

export default function NotFound() {
  const t = useT();
  return (
    <StatusPage mood="curious" title={t("err.page.notFound.title")} body={t("err.page.notFound.body")}>
      <LinkButton href="/" size="lg">
        {t("err.page.home")}
      </LinkButton>
    </StatusPage>
  );
}
