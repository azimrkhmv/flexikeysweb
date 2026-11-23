"use client";

/*
 * Shine Border, copied from Magic UI (https://magicui.design/docs/components/shine-border,
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
 * Changes for FlexiKeys (B119, Update 4 spec 8.3): `cn` replaced by a plain join (no shadcn set-up); the `animate-shine`
 * keyframes live in globals.css as one slow sweep and a pause, and the caller passes token colours only. Raw colours
 * swapped for tokens (noRawColours.test.ts): the default is `var(--accent)`, and the mask (any opaque colour; never
 * shown) uses `var(--ink)` instead of #fff.
 */

import type { CSSProperties, HTMLAttributes } from "react";

interface ShineBorderProps extends HTMLAttributes<HTMLDivElement> {
  /** Width of the border in pixels. @default 1 */
  borderWidth?: number;
  /** Duration of the animation in seconds. @default 14 */
  duration?: number;
  /** Color of the border, can be a single color or an array of colors. @default "var(--accent)" */
  shineColor?: string | string[];
}

/** An animated background border effect component with configurable properties. */
export function ShineBorder({ borderWidth = 1, duration = 14, shineColor = "var(--accent)", className = "", style, ...props }: ShineBorderProps) {
  return (
    <div
      style={
        {
          "--border-width": `${borderWidth}px`,
          "--duration": `${duration}s`,
          backgroundImage: `radial-gradient(transparent,transparent, ${Array.isArray(shineColor) ? shineColor.join(",") : shineColor},transparent,transparent)`,
          backgroundSize: "300% 300%",
          mask: `linear-gradient(var(--ink) 0 0) content-box, linear-gradient(var(--ink) 0 0)`,
          WebkitMask: `linear-gradient(var(--ink) 0 0) content-box, linear-gradient(var(--ink) 0 0)`,
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "var(--border-width)",
          ...style,
        } as CSSProperties
      }
      className={`motion-safe:animate-shine pointer-events-none absolute inset-0 size-full rounded-[inherit] will-change-[background-position] ${className}`}
      {...props}
    />
  );
}
