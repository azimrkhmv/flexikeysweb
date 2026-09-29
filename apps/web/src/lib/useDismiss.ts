"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Light-dismiss for popovers and menus (not modal): while `open`, Escape closes and returns focus to `trigger`;
 * a pointer press outside `root` closes without moving focus.
 */
export function useDismiss(root: RefObject<HTMLElement | null>, trigger: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      closeRef.current();
      trigger.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [root, trigger, open]);
}
