"use client";

import { CircleAlert, CircleCheck, Info, WifiOff } from "lucide-react";
import { toast, Toaster } from "sonner";
import { useIsPhone } from "@/lib/useMedia";

// B118 (Update 4 spec 8.2): short messages on parent, admin and sign-in pages, through Sonner. Unstyled, so only our
// token classes colour them; an error uses the accent text colour and an icon, never red. Bottom centre on phones
// (above the bottom menu), bottom right on laptops. Never on child screens (child routes do not render this; a test
// checks that no child file imports sonner). Texts come translated from the caller.

const base = "flex w-[min(360px,calc(100vw-32px))] items-start gap-3 rounded-fk border border-line bg-surface p-4 text-sm font-semibold text-ink shadow-lift";

export function Toasts() {
  const phone = useIsPhone();
  return (
    <Toaster
      position={phone ? "bottom-center" : "bottom-right"}
      offset={phone ? { bottom: 88 } : { bottom: 96, right: 24 }} // above the round feedback button
      mobileOffset={{ bottom: 88 }}
      gap={8}
      visibleToasts={3}
      icons={{
        success: <CircleCheck className="size-5 text-primary" aria-hidden />,
        error: <CircleAlert className="size-5 text-primary" aria-hidden />,
        info: <Info className="size-5 text-muted" aria-hidden />,
        warning: <WifiOff className="size-5 text-primary" aria-hidden />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: { toast: base, error: "border-primary", title: "leading-snug", description: "mt-0.5 font-normal text-muted", icon: "mt-px shrink-0" },
      }}
    />
  );
}

/** One short message. `kind` picks the icon; errors stay longer. */
export const notify = {
  ok: (text: string) => toast.success(text),
  error: (text: string) => toast.error(text, { duration: 6000 }),
  info: (text: string, id?: string) => toast.info(text, { id }),
  /** Offline/online (the questionnaire): one message at a time, replaced in place. */
  offline: (text: string) => toast.warning(text, { id: "fk-online", duration: Infinity }),
  online: (text: string) => toast.success(text, { id: "fk-online", duration: 4000 }),
};
