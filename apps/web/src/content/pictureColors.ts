/**
 * Colours of pictures of real things (Update 3 spec 5, 19 Nov 2026): they keep their own colours in every scheme, as
 * an apple stays red on a purple page. Emoji keep theirs by themselves; this file is for the few pictures drawn in
 * code. Listed in colourAllowList.txt. Everything else uses the scheme tokens (lib/theme.ts) or the task colours
 * (content/taskColors.ts).
 */

/** The rainbow at the end of Grow Cloudy, top to bottom. */
export const RAINBOW = ["#f6b26b", "#ffd966", "#a8d5a2", "#8fd3f0", "#b4a7d6"] as const;

/** The toothbrush picture (vocabulary): a blue handle, a white head, green bristles. */
export const TOOTHBRUSH = { handle: "#a9c8ec", head: "#dfe8f8", line: "#5b86c4", bristle: "#ffffff", bristleLine: "#7fbf85" } as const;

/** Google's sign-in logo: Google's own colours (their brand rules do not allow other colours). */
export const GOOGLE_LOGO = { yellow: "#FFC107", red: "#FF3D00", green: "#4CAF50", blue: "#1976D2" } as const;

/** A QR code for a therapist to scan: always dark on white, the only way every phone camera reads it. */
export const QR_CODE = { dark: "#27406b", light: "#ffffff" } as const;
