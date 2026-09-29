"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Baby, Bot, CreditCard, RotateCcw, Timer, Users } from "lucide-react";
import { Bars, Button, Card, Chip, Modal, PageHeader, Stat } from "@/components/ui";
import { SectionTitle, useMe, useNow } from "@/features/pro/shared";
import { api, sel } from "@/lib/api";
import { useT } from "@/lib/i18n";

const DAY = 86_400_000;
const SERVICES = ["api", "db", "redis", "worker", "storage", "email"] as const;

export default function AdminOverview() {
  const t = useT();
  const router = useRouter();
  const { db } = useMe();
  const now = useNow();
  const [confirm, setConfirm] = useState(false);

  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const stats = sel.admin.stats(db, weekAgo);
  const asked = sel.admin.aiQuestions(db);
  const days = Array.from({ length: 7 }, (_, i) => new Date(now - (6 - i) * DAY).toISOString().slice(0, 10));
  const byRole = asked.reduce<Record<string, number>>((acc, m) => {
    acc[m.askerRole] = (acc[m.askerRole] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader title={t("admin.overview.title")} subtitle={t("admin.audited")} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("admin.stat.users")} value={stats.users} icon={<Users className="size-6" />} tone="sky" />
        <Stat label={t("admin.stat.children")} value={stats.children} icon={<Baby className="size-6" />} tone="leaf" />
        <Stat label={t("admin.stat.paying")} value={stats.paying} icon={<CreditCard className="size-6" />} tone="sun" />
        <Stat label={t("admin.stat.sessions")} value={stats.sessions} icon={<Timer className="size-6" />} tone="lavender" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>{t("admin.health.title")}</SectionTitle>
          <p className="mb-3 text-sm text-muted">{t("admin.health.region")}</p>
          <ul className="divide-y divide-line">
            {SERVICES.map((s) => (
              <li key={s} className="flex items-center justify-between py-2.5">
                <span className="font-semibold text-ink">{t(`admin.health.${s}`)}</span>
                <Chip tone="gray">
                  <span className="size-2 rounded-full bg-muted" aria-hidden /> {t("admin.health.ok")}
                </Chip>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle>
            <Bot className="mr-1 inline size-5" aria-hidden /> {t("admin.ai.title")}
          </SectionTitle>
          <Bars data={days.map((d) => ({ label: d.slice(8), value: asked.filter((m) => m.at.startsWith(d)).length }))} height={110} tone="#b3a8e8" />
          <div className="mt-3 flex flex-wrap gap-2">
            {(["parent", "teacher", "therapist"] as const).map((r) => (
              <Chip key={r} tone="gray">
                {t(`role.${r}`)}: {byRole[r] ?? 0}
              </Chip>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">{t("admin.ai.quota")}</p>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle>{t("admin.support.title")}</SectionTitle>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-sm text-ink-2">{t("admin.support.resetHint")}</p>
            <Button variant="danger" onClick={() => setConfirm(true)}>
              <RotateCcw className="size-4" aria-hidden /> {t("admin.support.reset")}
            </Button>
          </div>
        </Card>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title={t("admin.support.reset")}>
        <p className="mb-5 text-ink-2">{t("admin.support.confirm")}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              api.resetDemo();
              router.replace("/login");
            }}
          >
            {t("admin.support.reset")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
