"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { useMoreNav } from "@/features/parent/nav";
import { useT } from "@/lib/i18n";

/** "More" (B100): the pages that are not one of the four main entries. On a phone this is how they are reached. */
export default function More() {
  const t = useT();
  const items = useMoreNav();
  return (
    <>
      <PageHeader title={t("more.title")} subtitle={t("more.subtitle")} />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="group block rounded-fk focus-visible:outline-none">
              <Card className="fk-tilt flex items-center gap-4 transition group-hover:shadow-lift group-focus-visible:ring-4 group-focus-visible:ring-teal">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl border-[1.5px] border-line bg-surface-2 text-ink">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-extrabold text-ink">{label}</span>
                  <span className="block text-sm text-muted">{t(`more.${href.split("/").pop()}`)}</span>
                </span>
                <ChevronRight className="size-5 text-muted" aria-hidden />
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
