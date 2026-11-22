"use client";

import { useQuery } from "@tanstack/react-query";
import { useDb as useMockDb } from "@/lib/api/db";
import { LIVE } from "@/lib/api/mode";
import { http } from "@/lib/live/http";
import { centerLinksFromDb, pilotFromDb, type CenterLink, type PilotNumbers } from "@/lib/pilot";

// The pilot numbers page's data (B113): GET /admin/pilot and /admin/center-links in live mode; the demo works the same
// numbers out from its own database with the same rules (lib/pilot.ts).

type Pilot = { numbers: PilotNumbers | null; links: CenterLink[] };

function useLivePilot(): Pilot {
  const numbers = useQuery({ queryKey: ["admin", "pilot"], queryFn: () => http<PilotNumbers>("GET", "/admin/pilot") });
  const links = useQuery({ queryKey: ["admin", "center-links"], queryFn: () => http<CenterLink[]>("GET", "/admin/center-links") });
  return { numbers: numbers.data ?? null, links: links.data ?? [] };
}

function useMockPilot(): Pilot {
  const db = useMockDb();
  return { numbers: pilotFromDb(db), links: centerLinksFromDb(db) };
}

export const usePilot = LIVE ? useLivePilot : useMockPilot;
