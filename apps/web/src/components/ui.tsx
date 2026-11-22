"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Switch } from "@base-ui/react/switch";
import { X } from "lucide-react";
import { Drawer } from "vaul";
import { ApiError } from "@/lib/api/schema";
import { useIsPhone } from "@/lib/useMedia";
import { useT } from "@/lib/i18n";

// Adult-UI atoms (WCAG 2.2 AA). Child UI uses features/play/Target instead.

type Variant = "primary" | "soft" | "ghost" | "outline" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "fk-btn",
  soft: "bg-primary-soft text-primary hover:brightness-95",
  ghost: "text-muted hover:bg-surface-2",
  outline: "fk-btn-2",
  danger: "bg-tint-2 text-primary hover:brightness-95",
};
const SIZES = { sm: "h-9 px-3 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-14 px-7 text-lg" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof SIZES = "md", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-full font-bold transition disabled:opacity-50 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  pending,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES; pending?: boolean }) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} disabled={pending || rest.disabled} {...rest}>
      {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "primary", size = "md", className = "", children }: { href: string; variant?: Variant; size?: keyof typeof SIZES; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Card({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "li" }) {
  return <Tag className={`fk-card p-5 ${className}`}>{children}</Tag>;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-bold text-ink">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="block text-sm font-semibold text-primary">
          {error}
        </span>
      )}
    </label>
  );
}

const inputCls = "fk-input w-full px-4 h-12 text-[15px] text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} h-auto min-h-24 py-3 ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} appearance-auto ${props.className ?? ""}`} />;
}

export function Checkbox({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${checked ? "border-primary bg-primary-soft/50" : "border-line bg-surface hover:bg-surface-2"} ${disabled ? "opacity-60" : ""}`}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="space-y-0.5">
        <span className="block text-[15px] font-semibold text-ink">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
    </label>
  );
}

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

/** Soft background + readable text for each brand tone (chips, icons, feature tiles). */
export const TONES = {
  sky: "bg-tint text-ink",
  leaf: "bg-primary-soft text-primary",
  sun: "bg-sun-soft text-ink",
  lavender: "bg-tint-2 text-primary",
  teal: "bg-primary-soft text-primary",
  peach: "bg-tint-2 text-primary",
  gray: "bg-surface-2 text-muted",
};
export type Tone = keyof typeof TONES;

export function Chip({ tone = "sky", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${TONES[tone]} ${className}`}>{children}</span>;
}

export function Avatar({ emoji, size = 44, className = "", tone = "sky" }: { emoji: string; size?: number; className?: string; tone?: Tone }) {
  return (
    <span aria-hidden className={`inline-grid shrink-0 place-items-center rounded-full ${TONES[tone]} ${className}`} style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {emoji}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, icon, tone = "sky" }: { label: string; value: ReactNode; icon?: ReactNode; tone?: Tone }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      {icon && <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${TONES[tone]}`}>{icon}</span>}
      <div className="min-w-0">
        <div className="text-2xl font-extrabold text-ink">{value}</div>
        <div className="line-clamp-2 text-sm leading-snug text-muted">{label}</div>
      </div>
    </Card>
  );
}

export function Empty({ children }: { children?: ReactNode }) {
  const t = useT();
  return <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">{children ?? t("common.none")}</p>;
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

/** Maps an ApiError code to a localized message. */
export function useErrorText() {
  const t = useT();
  return (e: unknown) => (e instanceof ApiError ? t(`err.${e.code}`) : t("err.generic"));
}

/** Wraps an async action with pending + localized error state. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errText = useErrorText();
  const run = async (...args: A): Promise<R | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await fn(...args);
    } catch (e) {
      setError(errText(e));
      return undefined;
    } finally {
      setPending(false);
    }
  };
  return { run, pending, error, setError };
}

export function Spinner({ label }: { label?: string }) {
  const t = useT();
  return (
    <div className="grid min-h-[40vh] place-items-center" role="status">
      <div className="flex flex-col items-center gap-3 text-muted">
        <span className="size-8 animate-spin rounded-full border-4 border-primary-soft border-t-primary" aria-hidden />
        <span className="text-sm">{label ?? t("common.loading")}</span>
      </div>
    </div>
  );
}

export function Bars({ data, max, unit, tone = "var(--hill2)", height = 140 }: { data: { label: string; value: number }[]; max?: number; unit?: string; tone?: string; height?: number }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}${unit ?? ""}`).join(", ")}>
      {data.map((d, i) => (
        <div key={i} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] font-bold text-muted opacity-0 group-hover:opacity-100">{d.value}</span>
          <div className="w-full rounded-t-lg transition-all" style={{ height: `${(d.value / m) * 100}%`, minHeight: d.value ? 4 : 2, background: d.value ? tone : "var(--line)" }} />
          <span className="w-full truncate text-center text-[10px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** `label` names the meter for screen readers (e.g. the skill or child it measures). */
export function Meter({ value, label, tone = "var(--accent)" }: { value: number; label: string; tone?: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(value * 100)}%`, background: tone }} />
    </div>
  );
}
