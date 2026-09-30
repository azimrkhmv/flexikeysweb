/**
 * Which backend the app talks to (build-time):
 * - "mock" (default): the in-browser mock in lib/api/ — demo data, nothing leaves the browser.
 * - "live": the FastAPI backend at /api/v1 (same origin; next.config rewrites it to FK_API_ORIGIN in dev,
 *   the reverse proxy does it in production). Only the connected areas use it — see lib/live/.
 */
export const LIVE = process.env.NEXT_PUBLIC_API_MODE === "live";
