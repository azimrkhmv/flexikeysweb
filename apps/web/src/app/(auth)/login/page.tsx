"use client";

import { PhoneFlow } from "@/features/auth/PhoneFlow";

/** Spec §4: phone + SMS only (Q7: email sign-in is deleted). */
export default function LoginPage() {
  return <PhoneFlow showDemos />;
}
