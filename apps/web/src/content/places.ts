// Find help (spec §11): what the parent picks, and the sample places the demo shows until our team's checked list
// exists (G2). Same names and rules as the server (apps/api app/modules/places/).

import type { Booking, GoalKey, Place, PlaceNeed, Slot } from "@/lib/types";

export const NEEDS: PlaceNeed[] = ["speech", "movement", "learning", "checkup"];
/** A price checked longer ago than this shows "price not recently checked" (spec §11: 6 months). */
export const PRICE_FRESH_DAYS = 183;

/** The child's own goals (P33) put the most relevant needs first (spec §11); never a diagnosis. */
const BY_GOAL: Partial<Record<GoalKey, PlaceNeed>> = {
  communicate: "speech",
  eat: "speech",
  walk: "movement",
  hands: "movement",
  sit: "movement",
  understand: "learning",
  school: "learning",
  play_others: "learning",
};
export function needsFor(goals: GoalKey[]): PlaceNeed[] {
  const first = [...new Set(goals.map((g) => BY_GOAL[g]).filter((n): n is PlaceNeed => !!n))];
  return [...first, ...NEEDS.filter((n) => !first.includes(n))];
}

const DAY = 86_400_000;
const daysAgo = (now: number, n: number) => new Date(now - n * DAY).toISOString().slice(0, 10);
const osm = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

/** PLACEHOLDER (G2): made-up places, marked `sample`, for the demo only. */
export function samplePlaces(now: number): Place[] {
  const p = (id: string, rest: Omit<Place, "id" | "sample" | "languages" | "worksWithCp"> & Partial<Pick<Place, "languages" | "worksWithCp">>): Place => ({
    id, sample: true, languages: ["uz", "ru"], worksWithCp: true, ...rest,
  });
  return [
    p("pl_centre", {
      name: "Bolalar reabilitatsiya markazi", kind: "state_centre", region: "tashkent_city", district: "Chilonzor", address: "Bunyodkor shoh koʻchasi, 1",
      lat: 41.285, lng: 69.204, mapUrl: osm(41.285, 69.204), phone: "+998712000001", needs: ["movement", "speech", "checkup"], ageMin: 0, ageMax: 18, checkedAt: daysAgo(now, 20),
    }),
    p("pl_clinic_speech", {
      name: "«Soʻz» logopediya markazi", kind: "private_clinic", region: "tashkent_city", district: "Yunusobod", address: "Amir Temur koʻchasi, 107",
      lat: 41.364, lng: 69.288, mapUrl: osm(41.364, 69.288), phone: "+998712000002", telegram: "@soz_markaz", needs: ["speech"], ageMin: 2, ageMax: 14, priceMin: 150_000, priceMax: 250_000, checkedAt: daysAgo(now, 30),
    }),
    p("pl_clinic_move", {
      name: "Harakat terapiyasi klinikasi", kind: "private_clinic", region: "tashkent_city", district: "Mirzo Ulugʻbek", address: "Buyuk Ipak Yoʻli, 50",
      lat: 41.327, lng: 69.334, mapUrl: osm(41.327, 69.334), phone: "+998712000003", languages: ["uz", "ru", "en"], needs: ["movement"], ageMin: 1, ageMax: 18, priceMin: 200_000, priceMax: 350_000, checkedAt: daysAgo(now, 250),
    }),
    p("pl_psych", {
      name: "Bolalar psixologi", kind: "specialist", region: "tashkent_city", district: "Chilonzor",
      phone: "+998901000004", needs: ["learning"], ageMin: 3, ageMax: 16, priceMin: 120_000, priceMax: 180_000, checkedAt: daysAgo(now, 45), worksWithCp: false,
    }),
    p("pl_polyclinic", {
      name: "Shahar bolalar poliklinikasi", kind: "state_centre", region: "tashkent_city", district: "Yakkasaroy", address: "Shota Rustaveli koʻchasi, 12",
      lat: 41.287, lng: 69.255, mapUrl: osm(41.287, 69.255), phone: "+998712000005", needs: ["checkup", "learning"], ageMin: 0, ageMax: 18, checkedAt: daysAgo(now, 60),
    }),
    p("pl_neuro", {
      name: "Bolalar nevrologi", kind: "specialist", region: "tashkent_city", district: "Mirobod",
      phone: "+998901000006", needs: ["checkup"], ageMin: 0, ageMax: 18, priceMin: 200_000, priceMax: 300_000, checkedAt: daysAgo(now, 10), languages: ["ru"],
    }),
  ];
}

/** PLACEHOLDER (G4): the sample clinics' free times for the coming week, Tashkent time; one is already taken by
 * another family, so it is never offered. */
export function sampleSlots(now: number): { slots: Slot[]; bookings: Booking[] } {
  const day = (n: number, hour: number) => {
    const d = new Date(now + n * DAY);
    return new Date(`${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:00:00+05:00`).toISOString();
  };
  const slots: Slot[] = [];
  for (const n of [1, 2, 3, 5]) {
    slots.push({ id: `sl_soz_${n}_10`, placeId: "pl_clinic_speech", startsAt: day(n, 10), minutes: 45, specialist: "Logoped", inPerson: true, online: true });
    slots.push({ id: `sl_soz_${n}_15`, placeId: "pl_clinic_speech", startsAt: day(n, 15), minutes: 45, specialist: "Logoped", inPerson: true, online: false });
    slots.push({ id: `sl_move_${n}_11`, placeId: "pl_clinic_move", startsAt: day(n, 11), minutes: 60, inPerson: true, online: false });
  }
  const bookings: Booking[] = [
    { id: "bk_other", slotId: "sl_soz_1_10", childId: "ch_other", bookedBy: "u_parent2", mode: "in_person", status: "confirmed", at: new Date(now).toISOString() },
  ];
  return { slots, bookings };
}
