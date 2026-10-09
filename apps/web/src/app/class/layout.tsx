import type { ReactNode } from "react";
import { LegacyOnly } from "@/features/auth/mode";

export default function ClassLayout({ children }: { children: ReactNode }) {
  return <LegacyOnly>{children}</LegacyOnly>;
}
