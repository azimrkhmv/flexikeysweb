"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * For custom (non-<dialog>) overlays: while `openKey` is set, focus moves into `ref`, Tab cycles inside it,
 * and focus returns to where it was when the overlay closes. A new `openKey` (e.g. menu → break) refocuses.
 * `onEscape` (optional) closes the overlay with the Escape key — pass it only where closing is a safe choice.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, openKey: string | null, onEscape?: () => void) {
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });
  useEffect(() => {
    const root = ref.current;
    if (!openKey || !root) return;
    const before = document.activeElement as HTMLElement | null;
    const items = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && escape.current) {
        e.preventDefault();
        escape.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (before?.isConnected) before.focus();
    };
  }, [ref, openKey]);
}
