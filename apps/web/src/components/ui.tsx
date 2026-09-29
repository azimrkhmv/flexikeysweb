"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";

// Adult-UI atoms (WCAG 2.2 AA). Child UI uses features/play/Target instead.

type Variant = "primary" | "soft" | "ghost" | "outline" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white hover:brightness-110 shadow-soft",
  soft: "bg-primary-soft text-primary hover:bg-[#d2def5]",
  ghost: "text-ink-2 hover:bg-surface-2",
  outline: "border border-line bg-surface text-ink hover:bg-surface-2",
  danger: "bg-peach-soft text-[#8f3a2c] hover:bg-[#fbdcd0]",
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
  return <Tag className={`rounded-fk border border-line bg-surface p-5 shadow-soft ${className}`}>{children}</Tag>;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-bold text-ink">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="block text-sm font-semibold text-[#8f3a2c]">
          {error}
        </span>
      )}
    </label>
  );
}

const inputCls = "w-full rounded-2xl border border-line bg-surface px-4 h-12 text-[15px] text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft";

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
    <label className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${checked ? "border-teal bg-teal-soft/50" : "border-line bg-surface hover:bg-surface-2"} ${disabled ? "opacity-60" : ""}`}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[#3fa79c]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="space-y-0.5">
        <span className="block text-[15px] font-semibold text-ink">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-teal" : "bg-line"}`}
    >
      <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

const TONES = {
  sky: "bg-sky-soft text-[#2f5d93]",
  leaf: "bg-leaf-soft text-[#2f6a37]",
  sun: "bg-sun-soft text-[#7a5a0c]",
  lavender: "bg-lavender-soft text-[#4f43a0]",
  teal: "bg-teal-soft text-[#1f6b63]",
  peach: "bg-peach-soft text-[#8f3a2c]",
  gray: "bg-surface-2 text-ink-2",
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
        {subtitle && <p className="mt-1 text-ink-2">{subtitle}</p>}
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
        <div className="truncate text-sm text-muted">{label}</div>
      </div>
    </Card>
  );
}

export function Empty({ children }: { children?: ReactNode }) {
  const t = useT();
  return <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">{children ?? t("common.none")}</p>;
}

/** Native <dialog> modal: focus trap, Esc to close and backdrop for free. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-fk-lg border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-[#27406b]/30 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <h2 className="mb-4 text-xl font-extrabold">{title}</h2>
        {children}
      </div>
    </dialog>
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

export function Bars({ data, max, unit, tone = "#a9c8ec", height = 140 }: { data: { label: string; value: number }[]; max?: number; unit?: string; tone?: string; height?: number }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}${unit ?? ""}`).join(", ")}>
      {data.map((d, i) => (
        <div key={i} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] font-bold text-muted opacity-0 group-hover:opacity-100">{d.value}</span>
          <div className="w-full rounded-t-lg transition-all" style={{ height: `${(d.value / m) * 100}%`, minHeight: d.value ? 4 : 2, background: d.value ? tone : "var(--fk-line)" }} />
          <span className="w-full truncate text-center text-[10px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Meter({ value, tone = "var(--fk-leaf)" }: { value: number; tone?: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(value * 100)}%`, background: tone }} />
    </div>
  );
}
