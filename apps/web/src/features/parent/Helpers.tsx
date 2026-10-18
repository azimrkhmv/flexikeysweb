"use client";

import { useState } from "react";
import { Button, Card, Field, Input, useAction } from "@/components/ui";
import { api, sel, useDb } from "@/lib/api";
import { MAX_HELPERS } from "@/lib/api/schema";
import { useT } from "@/lib/i18n";

// A8.4 / B27: one second adult (a helper) per family. The owner invites by phone and can remove them; a helper does
// daily use only (TASKS.md section 3). Invites for this person's own number show here too, to accept.

export function Helpers() {
  const t = useT();
  const db = useDb();
  const me = sel.me(db);
  const familyId = me ? sel.ownFamily(db, me.id) : null;
  const { helpers, invites } = sel.helpers(db, familyId);
  const forMe = sel.helperInvitesFor(db, me?.phone);
  const [phone, setPhone] = useState("");
  const invite = useAction(api.inviteHelper);
  const remove = useAction(api.removeHelper);
  const cancel = useAction(api.cancelHelperInvite);
  const accept = useAction(api.acceptHelperInvite);
  const owns = familyId !== null && sel.childrenOf(db, me!.id).some((c) => c.familyId === familyId);
  if (!me || (!owns && !forMe.length)) return null;

  return (
    <Card className="mt-6 space-y-4">
      <h2 className="text-lg font-extrabold text-ink">{t("parent.helpers.title")}</h2>
      {forMe.map((i) => (
        <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-teal-soft/50 p-3">
          <p className="min-w-0 flex-1 text-sm text-ink">{t("parent.helpers.invitedYou", { name: i.ownerName })}</p>
          <Button size="sm" pending={accept.pending} onClick={() => accept.run(i.id)}>
            {t("parent.helpers.accept")}
          </Button>
        </div>
      ))}
      {owns && (
        <>
          <p className="text-sm text-muted">{t("parent.helpers.hint")}</p>
          <ul className="space-y-2">
            {helpers.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3">
                <span className="min-w-0 flex-1 font-bold text-ink">
                  {h.name || h.phone} <span className="text-xs font-normal text-muted">{h.phone}</span>
                </span>
                <Button size="sm" variant="danger" pending={remove.pending} onClick={() => remove.run(h.id)}>
                  {t("parent.helpers.remove")}
                </Button>
              </li>
            ))}
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3">
                <span className="min-w-0 flex-1 text-sm text-ink">
                  {i.phone} · {t("parent.helpers.waiting")}
                </span>
                <Button size="sm" variant="ghost" pending={cancel.pending} onClick={() => cancel.run(i.id)}>
                  {t("parent.helpers.cancel")}
                </Button>
              </li>
            ))}
          </ul>
          {helpers.length < MAX_HELPERS && invites.length === 0 && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if ((await invite.run(phone)) !== undefined) setPhone("");
              }}
            >
              <div className="min-w-48 flex-1">
                <Field label={t("parent.helpers.phone")}>
                  <Input type="tel" inputMode="tel" placeholder="+998" required value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
              </div>
              <Button type="submit" pending={invite.pending}>
                {t("parent.helpers.invite")}
              </Button>
            </form>
          )}
        </>
      )}
      {[invite, remove, cancel, accept].map((a, k) => a.error && <p key={k} role="alert" className="text-sm font-semibold text-[#8f3a2c]">{a.error}</p>)}
    </Card>
  );
}
