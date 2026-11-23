"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Switch } from "@base-ui/react/switch";
import { X } from "lucide-react";
import { Drawer } from "vaul";
import { useIsPhone } from "@/lib/useMedia";
import { useT } from "@/lib/i18n";

// B120: the dialog, sheet and switch live here, not in ui.tsx, so pages that only use buttons and cards (the landing
// page, sign-up) do not download Base UI's dialog and Vaul (Lighthouse on a slow phone, Update 4 spec 9).

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  // B118: Base UI's switch (role, keyboard and the hidden input it handles); the look stays the same.
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={(v) => onChange(v)}
      aria-label={label}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-primary" : "bg-line"}`}
    >
      <Switch.Thumb className={`absolute top-1 size-5 rounded-full bg-surface shadow transition-all ${checked ? "left-6" : "left-1"}`} />
    </Switch.Root>
  );
}


/** B118 (Update 4 spec 8.2): a Base UI dialog on laptops, a Vaul bottom sheet on phones (under 768 px). Both trap
 * focus, close with Escape or the close button and give focus back to what opened them. A parent sheet may also be
 * dragged down. Child screens use ChildSheet (features/play), which only closes with its Done button. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useT();
  const phone = useIsPhone();
  // The button that opened it gets focus back on close (opened by state, so there is no Base UI trigger to return to).
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement && !document.activeElement.closest("[role=dialog]")) opener.current = document.activeElement;
  }, [open]);
  const back = () => (opener.current?.isConnected ? opener.current : true);
  const close = (
    <span className="sr-only">{t("common.close")}</span>
  );
  if (phone)
    return (
      <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/40" />
          <Drawer.Content
            aria-describedby={undefined}
            onCloseAutoFocus={(e) => {
              if (opener.current?.isConnected) {
                e.preventDefault();
                opener.current.focus();
              }
            }}
            className="fk-rim fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-fk-lg bg-surface text-ink shadow-lift outline-none">
            <Drawer.Handle className="mx-auto mt-3 !h-1.5 !w-12 shrink-0 rounded-full !bg-line" />
            <div className="flex items-start justify-between gap-3 px-5 pt-3">
              <Drawer.Title className="text-xl font-extrabold">{title}</Drawer.Title>
              <Drawer.Close className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
                <X className="size-5" aria-hidden />
                {close}
              </Drawer.Close>
            </div>
            <div className="overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">{children}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fk-fade-in fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Popup finalFocus={back} className="fk-pop-in fk-rim fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-fk-lg bg-surface p-6 text-ink shadow-lift outline-none">
          <div className="mb-4 flex items-start justify-between gap-3">
            <Dialog.Title className="text-xl font-extrabold">{title}</Dialog.Title>
            <Dialog.Close className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
              <X className="size-5" aria-hidden />
              {close}
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
