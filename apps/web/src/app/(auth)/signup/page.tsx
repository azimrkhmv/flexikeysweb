"use client";

import { PhoneFlow } from "@/features/auth/PhoneFlow";

/** Spec §4: phone + SMS for everyone; the details step (consent, district) follows a new number. */
export default function SignupPage() {
  return <PhoneFlow />;
}
