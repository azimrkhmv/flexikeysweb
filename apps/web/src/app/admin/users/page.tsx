"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button, Card, Chip, Empty, Input, PageHeader, Select, useAction, type Tone } from "@/components/ui";
import { fmtDate, Table, td, th, useMe } from "@/features/pro/shared";
import { api } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import type { Role, UserStatus } from "@/lib/types";

const STATUS_TONE: Record<UserStatus, Tone> = { active: "leaf", pending_verification: "sun", disabled: "gray" };
const ROLES: Role[] = ["parent", "teacher", "therapist", "admin"];

export default function AdminUsers() {
  const t = useT();
  const [lang] = useLang();
  const { db, me } = useMe();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const status = useAction(api.setUserStatus);
  const comp = useAction(api.grantComp);

  const needle = q.trim().toLowerCase();
  const users = db.users
    .filter((u) => (!role || u.role === role) && (!needle || u.email.includes(needle) || u.name.toLowerCase().includes(needle)))
    .sort((a, b) => Number(b.status === "pending_verification") - Number(a.status === "pending_verification") || a.email.localeCompare(b.email));

  return (
    <>
      <PageHeader title={t("admin.users.title")} subtitle={t("admin.audited")} />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="relative min-w-60 flex-1">
            <span className="sr-only">{t("admin.users.search")}</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.users.search")} className="pl-10" />
          </label>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role | "")} className="w-auto" aria-label={t("admin.users.role")}>
            <option value="">{t("admin.users.allRoles")}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`role.${r}`)}
              </option>
            ))}
          </Select>
        </div>
        {(status.error || comp.error) && <p className="mb-3 text-sm font-semibold text-[#8f3a2c]">{status.error || comp.error}</p>}
        {users.length === 0 ? (
          <Empty />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>{t("admin.users.user")}</th>
                <th className={th}>{t("admin.users.role")}</th>
                <th className={th}>{t("admin.users.status")}</th>
                <th className={th}>{t("admin.users.joined")}</th>
                <th className={th}>{t("admin.users.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className={td}>
                    <div className="font-bold">{u.name}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className={td}>{t(`role.${u.role}`)}</td>
                  <td className={td}>
                    <Chip tone={STATUS_TONE[u.status]}>{t(`status.${u.status}`)}</Chip>
                  </td>
                  <td className={td}>{fmtDate(u.createdAt, lang)}</td>
                  <td className={td}>
                    {u.id !== me.id && (
                      <div className="flex flex-wrap gap-2">
                        {u.status === "pending_verification" && (
                          <Button size="sm" onClick={() => status.run(u.id, "active")}>
                            {t("admin.users.approve")}
                          </Button>
                        )}
                        {u.status === "active" && (
                          <Button size="sm" variant="outline" onClick={() => status.run(u.id, "disabled")}>
                            {t("admin.users.disable")}
                          </Button>
                        )}
                        {u.status === "disabled" && (
                          <Button size="sm" variant="outline" onClick={() => status.run(u.id, "active")}>
                            {t("admin.users.enable")}
                          </Button>
                        )}
                        {u.role === "parent" && (
                          <Button size="sm" variant="soft" onClick={() => comp.run(u.id, 30)}>
                            {t("admin.users.comp")}
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
