"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Copy, Download } from "lucide-react";
import { Button, Card, Empty, Field, Input, PageHeader } from "@/components/ui";
import { regionName } from "@/content/districts";
import { FormError } from "@/features/auth/parts";
import { usePilot } from "@/features/pro/pilotData";
import { Table, td, th } from "@/features/pro/shared";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { toCsv } from "@/lib/pilot";
import { fmtUzs } from "@/content/offer";
import { SITE_URL } from "@/lib/site";

// Pilot numbers (B113, Update 4 spec 4): sign-ups per day, region and centre link, retained and quiet families, each
// table as a CSV; and the centre links (no QR code here: the team makes QR codes from the link).

const linkFor = (code: string) => `${SITE_URL.replace(/\/$/, "")}/?ref=${code}`;

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Section({ title, hint, csv, children }: { title: string; hint?: string; csv?: () => void; children: ReactNode }) {
  const t = useT();
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-ink">{title}</h2>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
        {csv && (
          <Button variant="outline" size="sm" onClick={csv}>
            <Download className="size-4" aria-hidden /> {t("pilot.csv")}
          </Button>
        )}
      </div>
      {children}
    </Card>
  );
}

function CenterLinks() {
  const t = useT();
  const [lang] = useLang();
  const { links } = usePilot();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.createCenterLink(name, code);
      setName("");
      setCode("");
    } catch (err) {
      setError(t(`err.${(err as { code?: string }).code ?? "generic"}`));
    } finally {
      setPending(false);
    }
  };
  const copy = async (c: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(c));
      setCopied(c);
    } catch {
      setCopied(null);
    }
  };
  return (
    <Section title={t("pilot.links.title")} hint={t("pilot.links.hint")}>
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label={t("pilot.links.name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </Field>
        <Field label={t("pilot.links.code")}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} required maxLength={32} placeholder="dvijeniye" />
        </Field>
        <Button type="submit" pending={pending}>{t("pilot.links.add")}</Button>
      </form>
      <FormError>{error}</FormError>
      {links.length === 0 ? (
        <Empty />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>{t("pilot.centre")}</th>
              <th className={th}>{t("pilot.links.link")}</th>
              <th className={th}>{t("pilot.links.signups")}</th>
              <th className={th}>{t("pilot.links.made")}</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id}>
                <td className={td}>{l.name}</td>
                <td className={td}>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="break-all text-xs">{linkFor(l.code)}</code>
                    <Button variant="ghost" size="sm" onClick={() => copy(l.code)} aria-label={`${t("pilot.links.copy")} ${l.name}`}>
                      <Copy className="size-4" aria-hidden /> {copied === l.code ? t("pilot.links.copied") : t("pilot.links.copy")}
                    </Button>
                  </div>
                </td>
                <td className={td}>{l.signups}</td>
                <td className={`${td} whitespace-nowrap`}>{fmtDate(l.createdAt, lang)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p aria-live="polite" className="sr-only">{copied ? t("pilot.links.copied") : ""}</p>
    </Section>
  );
}

export default function AdminPilot() {
  const t = useT();
  const [lang] = useLang();
  const { numbers: n, links } = usePilot();
  const region = (r: string | null): string => (r ? (regionName(r, lang) ?? r) : t("pilot.noRegion"));
  const centre = (c: string | null) => (c ? (links.find((l) => l.code === c)?.name ?? c) : t("pilot.noLink"));
  const share = n && n.signedUp ? Math.round((100 * n.retained) / n.signedUp) : 0;

  return (
    <>
      <PageHeader title={t("pilot.title")} subtitle={t("pilot.subtitle")} />
      <div className="space-y-6">
        {!n ? (
          <Card><Empty /></Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <p className="text-sm font-bold text-muted">{t("pilot.signedUp")}</p>
                <p className="text-3xl font-extrabold text-ink" data-testid="pilot-signed-up">{n.signedUp}</p>
              </Card>
              <Card>
                <p className="text-sm font-bold text-muted">{t("pilot.retained")}</p>
                <p className="text-3xl font-extrabold text-ink" data-testid="pilot-retained">{n.retained}</p>
                <p className="text-sm text-muted">{t("pilot.retained.of", { n: n.retained, total: n.signedUp, share })}</p>
                <p className="mt-1 text-xs text-muted">{t("pilot.retained.hint")}</p>
              </Card>
              <Card>
                <p className="text-sm font-bold text-muted">{t("pilot.revenue")}</p>
                <p className="text-3xl font-extrabold text-ink" data-testid="pilot-revenue">{fmtUzs(n.revenueUzs)} <span className="text-lg">{t("pay.uzs")}</span></p>
                <p className="text-sm text-muted">{t("pilot.revenue.hint")}</p>
              </Card>
              <Card>
                <p className="text-sm font-bold text-muted">{t("pilot.paying")}</p>
                <p className="text-3xl font-extrabold text-ink" data-testid="pilot-paying">{n.payingFamilies}</p>
              </Card>
            </div>

            <Section
              title={t("pilot.quiet.title")}
              hint={t("pilot.quiet.hint")}
              csv={() =>
                download(
                  `quiet-families-${n.today}.csv`,
                  toCsv(
                    [t("pilot.parent"), t("pilot.contact"), t("pilot.region"), t("pilot.centre"), t("pilot.signedUpOn"), t("pilot.lastActive")],
                    n.quiet.map((q) => [q.name, q.phone, region(q.region), centre(q.refCode), q.signedUp, q.lastActive ?? t("pilot.never")]),
                  ),
                )
              }
            >
              {n.quiet.length === 0 ? (
                <Empty />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      {["pilot.parent", "pilot.contact", "pilot.region", "pilot.centre", "pilot.signedUpOn", "pilot.lastActive"].map((k) => (
                        <th key={k} className={th}>{t(k)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {n.quiet.map((q) => (
                      <tr key={q.userId}>
                        <td className={td}>{q.name || "—"}</td>
                        <td className={`${td} whitespace-nowrap`}><a className="text-primary underline" href={`tel:${q.phone}`}>{q.phone}</a></td>
                        <td className={td}>{region(q.region)}</td>
                        <td className={td}>{centre(q.refCode)}</td>
                        <td className={`${td} whitespace-nowrap`}>{fmtDate(q.signedUp, lang)}</td>
                        <td className={`${td} whitespace-nowrap`}>{q.lastActive ? fmtDate(q.lastActive, lang) : t("pilot.never")}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Section>

            <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
              <Section title={t("pilot.byDay")} csv={() => download(`signups-by-day-${n.today}.csv`, toCsv([t("pilot.day"), t("pilot.count")], n.signupsByDay.map((d) => [d.day, d.count])))}>
                <CountTable head={t("pilot.day")} rows={n.signupsByDay.map((d) => [fmtDate(d.day, lang), d.count])} />
              </Section>
              <Section title={t("pilot.byRegion")} csv={() => download(`signups-by-region-${n.today}.csv`, toCsv([t("pilot.region"), t("pilot.count")], n.byRegion.map((r) => [region(r.region), r.count])))}>
                <CountTable head={t("pilot.region")} rows={n.byRegion.map((r) => [region(r.region), r.count])} />
              </Section>
              <Section title={t("pilot.byCenter")} csv={() => download(`signups-by-centre-${n.today}.csv`, toCsv([t("pilot.centre"), t("pilot.count")], n.byCenter.map((c) => [centre(c.code), c.count])))}>
                <CountTable head={t("pilot.centre")} rows={n.byCenter.map((c) => [centre(c.code), c.count])} />
              </Section>
            </div>
          </>
        )}
        <CenterLinks />
      </div>
    </>
  );
}

function CountTable({ head, rows }: { head: string; rows: [string, number][] }) {
  const t = useT();
  if (!rows.length) return <Empty />;
  return (
    <Table>
      <thead>
        <tr>
          <th className={th}>{head}</th>
          <th className={th}>{t("pilot.count")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td className={td}>{k}</td>
            <td className={td}>{v}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
