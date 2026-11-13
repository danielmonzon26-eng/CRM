import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

/** A headline number that links to where it comes from. */
export function Kpi({
  icon: Icon,
  tone,
  value,
  label,
  detail,
  href,
  alert = false,
}: {
  icon: LucideIcon;
  tone: string;
  value: string;
  label: string;
  detail: string;
  href: string;
  /** Draws the eye when the number needs action. */
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border bg-white p-4 shadow-card transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:shadow-popover ${
        alert ? "border-amber-300 hover:border-amber-400" : "border-slate-200 hover:border-brand-200"
      }`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
    </Link>
  );
}

export function Panel({
  title,
  subtitle,
  href,
  linkLabel = "View all",
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`}>
      <header className="flex items-start justify-between gap-3 rounded-t-xl border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="flex shrink-0 items-center gap-0.5 pt-0.5 text-sm font-medium text-brand-600 hover:text-brand-700">
            {linkLabel}
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

export function PanelEmpty({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-5 py-9 text-center">
      <Icon className="h-5 w-5 text-slate-400" strokeWidth={2} />
      <div className="mt-2 max-w-sm text-sm text-slate-500">{children}</div>
    </div>
  );
}

/**
 * One labelled horizontal bar: the value is always printed, so the bar only adds the
 * comparison. A marker line can show a target.
 */
export function BarRow({
  label,
  value,
  max,
  valueLabel,
  barClass = "bg-brand-500",
  target,
  href,
}: {
  label: React.ReactNode;
  value: number;
  max: number;
  valueLabel: string;
  barClass?: string;
  target?: number | null;
  href?: string;
}) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const targetAt = target && max > 0 ? Math.min(100, (target / max) * 100) : null;
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-slate-700">{label}</span>
        <span className="shrink-0 tabular-nums font-medium text-slate-900">{valueLabel}</span>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${barClass}`} style={{ width: `${width}%` }} />
        {targetAt !== null && (
          <span aria-hidden="true" title="Target" className="absolute -top-1 h-4 w-0.5 rounded bg-slate-700" style={{ left: `calc(${targetAt}% - 1px)` }} />
        )}
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-lg px-2 py-1.5 hover:bg-slate-50">
      {body}
    </Link>
  ) : (
    <div className="px-2 py-1.5">{body}</div>
  );
}

export function money(value: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}
