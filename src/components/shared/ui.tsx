import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "info" | "success" | "warning" | "danger" | "neutral" | "brand";

export function Card({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--os-border)] bg-white shadow-[var(--shadow-card)]",
        interactive && "transition hover:border-[var(--os-border-strong)] hover:shadow-[var(--shadow-pop)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--os-border)] px-5 py-4">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--os-sky)] text-[var(--os-blue)]">
            {icon}
          </span>
        ) : null}
        <div>
          <h3 className="font-display text-base font-semibold text-[var(--os-navy)]">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-sm text-[var(--os-muted)]">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "brand",
  icon,
  onClick,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: Tone;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const accents: Record<Tone, string> = {
    brand: "text-[var(--os-blue)] bg-[var(--os-sky)]",
    info: "text-[var(--os-blue)] bg-[var(--os-sky)]",
    success: "text-[var(--os-success)] bg-[var(--os-green-soft)]",
    warning: "text-[var(--os-warning)] bg-[var(--os-warning-soft)]",
    danger: "text-[var(--os-danger)] bg-[var(--os-danger-soft)]",
    neutral: "text-[var(--os-muted)] bg-[var(--os-soft)]",
  };

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "animate-fade-up w-full rounded-[var(--radius-card)] border border-[var(--os-border)] bg-white p-5 text-left shadow-[var(--shadow-card)]",
        onClick && "transition hover:border-[var(--os-border-strong)] hover:shadow-[var(--shadow-pop)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-[var(--os-muted)]">{label}</div>
        {icon ? (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accents[tone])}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="tabular mt-3 text-[28px] font-semibold leading-none text-[var(--os-navy)]">
        {value}
      </div>
      <div className="mt-2 text-sm text-[var(--os-muted)]">{hint}</div>
    </Wrapper>
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "success" | "danger";
  size?: "sm" | "md";
}) {
  const variants = {
    primary: "bg-[var(--os-blue)] text-white hover:bg-[var(--os-blue-dark)] shadow-sm",
    secondary: "bg-[var(--os-sky)] text-[var(--os-blue-dark)] hover:bg-[var(--os-sky-strong)]",
    outline:
      "border border-[var(--os-border-strong)] bg-white text-[var(--os-navy)] hover:bg-[var(--os-soft)]",
    ghost: "bg-transparent text-[var(--os-muted-strong)] hover:bg-[var(--os-soft)]",
    success: "bg-[var(--os-green)] text-white hover:bg-[#268a49] shadow-sm",
    danger: "bg-[var(--os-danger)] text-white hover:bg-[#b53534] shadow-sm",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-[13px]",
    md: "px-4 py-2.5 text-sm",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  const tones: Record<Tone, string> = {
    brand: "bg-[var(--os-sky)] text-[var(--os-blue-dark)]",
    info: "bg-[var(--os-sky)] text-[var(--os-blue-dark)]",
    success: "bg-[var(--os-green-soft)] text-[var(--os-success)]",
    warning: "bg-[var(--os-warning-soft)] text-[var(--os-warning)]",
    danger: "bg-[var(--os-danger-soft)] text-[var(--os-danger)]",
    neutral: "bg-[var(--os-soft)] text-[var(--os-muted-strong)]",
  };

  const dots: Record<Tone, string> = {
    brand: "bg-[var(--os-blue)]",
    info: "bg-[var(--os-blue)]",
    success: "bg-[var(--os-success)]",
    warning: "bg-[var(--os-warning)]",
    danger: "bg-[var(--os-danger)]",
    neutral: "bg-[var(--os-muted)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} /> : null}
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--os-blue)]">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display text-[26px] font-semibold leading-tight text-[var(--os-navy)]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-[var(--os-muted)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return <PageHeader title={title} subtitle={subtitle} action={action} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="flex min-h-[280px] flex-col items-center justify-center p-10 text-center">
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--os-sky)] text-[var(--os-blue)]">
          {icon}
        </div>
      ) : null}
      <h2 className="font-display text-xl font-semibold text-[var(--os-navy)]">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--os-muted)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-xl border border-[var(--os-border)] bg-[var(--os-soft)] p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition",
              active
                ? "bg-white text-[var(--os-navy)] shadow-sm"
                : "text-[var(--os-muted)] hover:text-[var(--os-navy)]",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function KeyValue({
  label,
  value,
  help,
}: {
  label: string;
  value: ReactNode;
  help?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--os-border)] bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--os-muted)]">
          {label}
        </div>
        {help}
      </div>
      <div className="mt-1.5 break-words text-sm font-medium text-[var(--os-navy)]">{value}</div>
    </div>
  );
}

export function EvidenceNote({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg bg-[var(--os-soft)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--os-muted)]">
      {items.join("  ·  ")}
    </div>
  );
}
