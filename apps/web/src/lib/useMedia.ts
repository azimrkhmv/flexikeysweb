"use client";

import { useSyncExternalStore } from "react";

// B118: phones get bottom sheets (Vaul), laptops keep the dialog (Base UI). 768 px, the spec's line.
const PHONE = "(max-width: 767px)";

function subscribe(cb: () => void) {
  try {
    const m = matchMedia(PHONE);
    m.addEventListener("change", cb);
    return () => m.removeEventListener("change", cb);
  } catch {
    return () => {};
  }
}
const read = () => {
  try {
    return matchMedia(PHONE).matches;
  } catch {
    return false;
  }
};

/** True under 768 px (false while the server renders). */
export const useIsPhone = () => useSyncExternalStore(subscribe, read, () => false);
