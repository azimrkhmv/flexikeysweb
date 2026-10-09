"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { IntakeWizard } from "@/features/intake/Wizard";
import { NewChildLegacy } from "@/features/parent/NewChildLegacy";
import { useLegacy } from "@/features/auth/mode";

/** Adding a child is the parent intake (spec §5). Live mode keeps the older form until the backend has intake. */
export default function NewChild() {
  if (useLegacy()) return <NewChildLegacy />;
  return (
    <Suspense>
      <WithChild />
    </Suspense>
  );
}

function WithChild() {
  const child = useSearchParams().get("child") ?? undefined;
  return <IntakeWizard childId={child} />;
}
