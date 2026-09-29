"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Mail } from "lucide-react";
import { Avatar, Button, Card, Chip, Empty, Field, Input, Meter, PageHeader, useAction } from "@/components/ui";
import { avgMastery, fmtDate, pct, SectionTitle, useMe, useNow } from "@/features/pro/shared";
import { api, sel } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

export default function TherapistHome() {
  const t = useT();
  const [lang] = useLang();
  const { db, me } = useMe();
  const year = new Date(useNow()).getFullYear();
  const kids = sel.therapistChildren(db, me.id);
  const invites = sel.invitesFor(db, me.email);
  const accept = useAction(api.acceptInvite);
  const [code, setCode] = useState("");

  return (
    <>
      <PageHeader title={t("therapist.home.title")} subtitle={t("therapist.home.subtitle")} />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section aria-labelledby="my-children">
          <h2 id="my-children" className="sr-only">
            {t("therapist.nav.children")}
          </h2>
          {kids.length === 0 ? (
            <Empty>{t("therapist.home.empty")}</Empty>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {kids.map((c) => {
                const avg = avgMastery(db, c.id);
                const goals = sel.openGoals(db, c.id);
                return (
                  <li key={c.id}>
                    <Link href={`/therapist/child/${c.id}`} className="block rounded-fk border border-line bg-surface p-5 shadow-soft transition hover:shadow-lift">
                      <div className="flex items-center gap-3">
                        <Avatar emoji={c.avatar} size={52} />
                        <div className="min-w-0 flex-1">
                          <div className="text-lg font-extrabold text-ink">{c.name}</div>
                          <div className="text-sm text-muted">{t("common.years", { n: year - c.birthYear })}</div>
                        </div>
                        <ChevronRight className="size-5 text-muted" aria-hidden />
                      </div>
                      <div className="mt-4 mb-1 flex justify-between text-xs text-muted">
                        <span>{t("teacher.roster.mastery")}</span>
                        <span>{avg ? pct(avg) : "—"}</span>
                      </div>
                      <Meter value={avg} label={`${c.name}: ${t("teacher.roster.mastery")}`} />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Chip tone="sky">
                          {t("teacher.roster.last")}: {fmtDate(sel.sessions(db, c.id)[0]?.startedAt, lang)}
                        </Chip>
                        <Chip tone="leaf">{t("therapist.home.openGoals", { n: goals })}</Chip>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Card>
          <SectionTitle>{t("therapist.invites.title")}</SectionTitle>
          {invites.length === 0 ? (
            <p className="mb-4 text-sm text-muted">{t("therapist.invites.none")}</p>
          ) : (
            <ul className="mb-4 space-y-2">
              {invites.map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-teal-soft/50 p-3">
                  <Mail className="size-5 shrink-0 text-teal" aria-hidden />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-bold text-ink">{sel.child(db, l.childId)?.name}</div>
                    <div className="text-muted">{fmtDate(l.createdAt, lang)}</div>
                  </div>
                  <Button size="sm" pending={accept.pending} onClick={() => accept.run(l.code)}>
                    {t("therapist.invites.accept")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="space-y-3 border-t border-line pt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await accept.run(code)) setCode("");
            }}
          >
            <Field label={t("therapist.invites.code")} hint={t("therapist.invites.codeHint")}>
              <Input
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                autoCapitalize="characters"
                className="font-mono tracking-widest"
                placeholder="ABC234"
              />
            </Field>
            <Button type="submit" variant="soft" pending={accept.pending}>
              {t("therapist.invites.accept")}
            </Button>
          </form>
          {accept.error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-[#8f3a2c]">
              {accept.error}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
