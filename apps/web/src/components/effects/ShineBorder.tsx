"use client";

/*
 * Shine Border, adapted from Magic UI (https://magicui.design/docs/components/shine-border,
 * registry/magicui/shine-border.tsx, 23 Nov 2026).
 *
 * MIT License. Copyright (c) Magic UI.
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright
 * notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
 *
 * Changes for FlexiKeys (B119, Update 4 spec 8.3 and 9):
 * - Same ring: the masked layer `padding: var(--border-width)` with the content-box mask, as in Magic UI.
 * - The original moved `background-position`, which repaints every frame (Lighthouse: +1.1 s of rendering on a slow
 *   phone). Here a gradient spot inside the ring turns with `transform` and fades with `opacity` only, so the
 *   compositor draws it and nothing repaints (the project's animation rule). Keyframes: `shine` in globals.css.
 * - `cn` replaced by a plain join (no shadcn set-up); colours are tokens: the default is `var(--accent)`, and the mask
 *   (any opaque colour; never shown) uses `var(--ink)` instead of #fff.
 */

import type { CSSProperties, HTMLAttributes } from "react";

interface ShineBorderProps extends HTMLAttributes<HTMLDivElement> {
  /** Width of the border in pixels. @default 1 */
  borderWidth?: number;
  /** Duration of one shine and its pause, in seconds. @default 14 */
  duration?: number;
  /** Color of the border, can be a single color or an array of colors. @default "var(--accent)" */
  shineColor?: string | string[];
}

/** An animated border effect: a slow shine travels once round the edge, then rests. */
export function ShineBorder({ borderWidth = 1, duration = 14, shineColor = "var(--accent)", className = "", style, ...props }: ShineBorderProps) {
  const colours = Array.isArray(shineColor) ? shineColor.join(",") : shineColor;
  return (
    <div
      style={
        {
          "--border-width": `${borderWidth}px`,
          "--duration": `${duration}s`,
          mask: `linear-gradient(var(--ink) 0 0) content-box, linear-gradient(var(--ink) 0 0)`,
          WebkitMask: `linear-gradient(var(--ink) 0 0) content-box, linear-gradient(var(--ink) 0 0)`,
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "var(--border-width)",
          ...style,
        } as CSSProperties
      }
      className={`pointer-events-none absolute inset-0 size-full overflow-hidden rounded-[inherit] ${className}`}
      {...props}
    >
      {/* A square much larger than the button, centred on it; one bright arc turns round with the square. */}
      <div
        className="motion-safe:animate-shine absolute left-1/2 top-1/2 aspect-square w-[300%] opacity-0 will-change-transform"
        style={{ background: `conic-gradient(from 0deg, transparent 0deg 250deg, ${colours}, transparent 360deg)`, transform: "translate(-50%, -50%)" }}
      />
    </div>
  );
}
