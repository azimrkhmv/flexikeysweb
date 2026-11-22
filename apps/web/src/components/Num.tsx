"use client";

import { useEffect, useState, type ComponentType } from "react";

// B118 (Update 4 spec 8.2): a number that changes on a parent or admin page rolls to its new value (NumberFlow). The
// library is loaded lazily after the page shows, so the plain number comes first and the first paint is not slowed.
// NumberFlow follows the device's reduced-motion setting (the number then just changes). Never on child screens: the
// child never sees a number (`content/offer.test.ts`-style check in `components/libraries.test.ts`).

type FlowProps = { value: number; locales?: string; format?: Intl.NumberFormatOptions };
let Flow: ComponentType<FlowProps> | null = null;
let loading: Promise<void> | null = null;
const load = () =>
  (loading ??= import("@number-flow/react").then((m) => {
    Flow = m.default as ComponentType<FlowProps>;
  }));

export function Num({ value, locales }: { value: number; locales?: string }) {
  const [ready, setReady] = useState(!!Flow);
  useEffect(() => {
    if (ready) return;
    let live = true;
    load().then(() => live && setReady(true), () => {});
    return () => {
      live = false;
    };
  }, [ready]);
  const Loaded = ready ? Flow : null;
  const text = value.toLocaleString(locales);
  if (!Loaded) return <span className="tabular-nums">{text}</span>;
  // The digits roll inside NumberFlow's shadow root, which page text (and some screen readers) cannot see; the plain
  // number stays in the page for them.
  return (
    <span className="tabular-nums">
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        <Loaded value={value} locales={locales} format={{ useGrouping: true }} />
      </span>
    </span>
  );
}
