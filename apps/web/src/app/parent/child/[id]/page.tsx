"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Play } from "lucide-react";
import { Avatar, Button, Empty, useAction } from "@/components/ui";
import { PlanTab } from "@/features/intake/PlanTab";
import { AacTab, ChangesTab, PrivacyTab, ProgressTab, SettingsTab, SharingTab, TABS, type Tab } from "@/features/parent/ChildTabs";
import { age } from "@/features/parent/lib";
import { api, sel, useDb } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function ChildPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const db = useDb();
  const me = sel.me(db);
  // Page only renders after hydration (AppShell gate), so reading the hash here is safe.
  const [tab, setTab] = useState<Tab>(() => {
    const h = (typeof window === "undefined" ? "" : window.location.hash.slice(1)) as Tab;
    return TABS.includes(h) ? h : "plan";
  });
  const start = useAction(api.startChildMode);
  const child = sel.child(db, id);

  if (!me || !child || sel.access(db, me.id, id) !== "owner")
    return (
      <div className="space-y-4">
        <Empty>{t("err.not_found")}</Empty>
        <Link href="/parent" className="font-bold text-primary">
          {t("common.back")}
        </Link>
      </div>
    );

  const go = (next: Tab) => {
    setTab(next);
    history.replaceState(null, "", `#${next}`);
  };

  return (
    <>
      <Link href="/parent" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {t("parent.nav.overview")}
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar emoji={child.avatar} size={72} tone="lavender" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{child.name}</h1>
          <p className="text-ink-2">
            {t("common.years", { n: age(child.birthYear) })} · {t("parent.home.learns", { lang: t(`lang.${child.learningLang}`) })}
          </p>
        </div>
        <Button
          size="lg"
          pending={start.pending}
          onClick={async () => {
            if ((await start.run(child.id)) !== undefined) router.push("/play");
          }}
        >
          <Play className="size-5" aria-hidden /> {t("parent.child.playNow")}
        </Button>
      </div>
      {start.error && (
        <p role="alert" className="mb-4 text-sm font-semibold text-[#8f3a2c]">
          {start.error}
        </p>
      )}
      {!sel.hasConsent(db, child.id, "core") && (
        // No consent recorded (e.g. a profile from the mobile app): nothing is saved until the parent gives it.
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sun-soft px-4 py-3">
          <p className="text-sm font-semibold text-[#7a5a0c]">{t("parent.privacy.coreMissing")}</p>
          {tab !== "privacy" && (
            <Button size="sm" variant="outline" onClick={() => go("privacy")}>
              {t("common.openPrivacy")}
            </Button>
          )}
        </div>
      )}

      <div
        role="tablist"
        aria-label={child.name}
        className="mb-6 flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-1"
        onKeyDown={(e) => {
          // WAI-ARIA tabs: arrows / Home / End move between tabs (roving tabindex).
          const i = TABS.indexOf(tab);
          const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
          if (next === undefined) return;
          e.preventDefault();
          const k = TABS[(next + TABS.length) % TABS.length];
          go(k);
          document.getElementById(`tab-${k}`)?.focus();
        }}
      >
        {TABS.map((k) => (
          <button
            key={k}
            id={`tab-${k}`}
            role="tab"
            type="button"
            aria-selected={tab === k}
            aria-controls="child-tabpanel"
            tabIndex={tab === k ? 0 : -1}
            onClick={() => go(k)}
            className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold transition ${tab === k ? "bg-surface text-primary shadow-soft" : "text-ink-2 hover:text-ink"}`}
          >
            {t(`parent.tab.${k}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="child-tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
        {tab === "plan" && <PlanTab child={child} />}
        {tab === "progress" && <ProgressTab childId={child.id} />}
        {tab === "changes" && <ChangesTab childId={child.id} />}
        {tab === "aac" && <AacTab childId={child.id} />}
        {tab === "sharing" && <SharingTab childId={child.id} goTab={go} />}
        {tab === "settings" && <SettingsTab child={child} />}
        {tab === "privacy" && <PrivacyTab child={child} />}
      </div>
    </>
  );
}
