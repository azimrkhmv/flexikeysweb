"use client";

import "@/messages/child";
import { useSyncExternalStore } from "react";
import { Spinner } from "@/components/ui";
import { PlayCheck } from "@/features/play/PlayCheck";
import { sel, useDb } from "@/lib/api";
import { useMounted } from "@/lib/store";

const noSubscribe = () => () => {};

/** /play/check?child=<id> — the play check, started by the parent from the child's page (spec §7). */
export default function PlayCheckPage() {
  const mounted = useMounted();
  const db = useDb();
  const childId = new URLSearchParams(useSyncExternalStore(noSubscribe, () => window.location.search, () => "")).get("child");
  if (!mounted || sel.loading(db)) return <Spinner />;
  const me = sel.me(db);
  const child = me && childId ? sel.childrenOf(db, me.id).find((c) => c.id === childId) : undefined;
  if (!child) return <Spinner />;
  return <PlayCheck key={child.id} child={child} />;
}
