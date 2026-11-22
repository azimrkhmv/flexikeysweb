"use client";

import { useQuery } from "@tanstack/react-query";
import { sel } from "@/lib/api";
import { useDb as useMockDb } from "@/lib/api/db";
import { LIVE } from "@/lib/api/mode";
import { http } from "@/lib/live/http";

// The admin's Billing page (B114): every family with its plan and the payments taken by hand. Live: GET /admin/billing;
// the demo works the same rows out from its own database.

export interface ManualPayment {
  id: string;
  amountUzs: number;
  method: string;
  paidUntil: string; // YYYY-MM-DD
  note: string;
  createdAt: string;
}

export interface FamilyBilling {
  familyId: string;
  ownerId: string;
  ownerName: string | null;
  ownerPhone: string;
  signedUpAt: string | null;
  plan: { plan: "free" | "pro"; trial: boolean; trialEndsAt?: string | null; paidUntil?: string | null };
  payments: ManualPayment[];
}

function useLiveBilling(): FamilyBilling[] {
  return useQuery({ queryKey: ["admin", "billing"], queryFn: () => http<FamilyBilling[]>("GET", "/admin/billing") }).data ?? [];
}

function useMockBilling(): FamilyBilling[] {
  return sel.admin.billing(useMockDb());
}

export const useBilling = LIVE ? useLiveBilling : useMockBilling;
