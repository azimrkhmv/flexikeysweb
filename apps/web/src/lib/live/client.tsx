"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/schema";
import { LIVE } from "@/lib/api/mode";

/** One cache for the whole app, in memory only (personal data never goes to localStorage in live mode). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (n, e) => n < 2 && !(e instanceof ApiError && ["unauthorized", "not_found", "forbidden"].includes(e.code)),
    },
  },
});

export function LiveProvider({ children }: { children: ReactNode }) {
  return LIVE ? <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> : children;
}
