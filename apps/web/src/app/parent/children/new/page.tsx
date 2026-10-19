"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { IntakeWizard } from "@/features/intake/Wizard";

/** Adding a child is the parent intake (spec §5). */
export default function NewChild() {
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
