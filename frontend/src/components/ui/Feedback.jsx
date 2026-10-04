import { AlertCircle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { cn } from "../../lib/utils";

/* ─── Alert: inline, persistent message about the current view ───────────── */

const ALERT_TONES = {
  error: { Icon: AlertCircle, cls: "border-danger/40 bg-danger-subtle text-danger", role: "alert" },
  success: { Icon: CheckCircle2, cls: "border-success/40 bg-success-subtle text-success", role: "status" },
  info: { Icon: Info, cls: "border-line bg-surface-raised text-subtle", role: "status" },
};

export function Alert({
  tone = "error",
  children,
  onDismiss,
  className,
}) {
  const { Icon, cls, role } = ALERT_TONES[tone];
  return (
    <div role={role} className={cn("flex items-start gap-2.5 rounded-md border px-3 py-2 text-[13px]", cls, className)}>
      <Icon size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1 rounded p-1 opacity-70 hover:opacity-100"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ─── EmptyState: what is missing and what to do about it ────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {Icon && <Icon size={20} className="text-subtlest" aria-hidden="true" />}
      <p className="mt-3 text-sm font-medium text-text">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-subtle">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─── Loading ────────────────────────────────────────────────────────────── */

export function Spinner({ label = "Loading", className }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-[13px] text-subtle", className)}>
      <Loader2 size={15} className="animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded bg-surface-hover", className)} />;
}

/** Placeholder rows shaped like the table/list they stand in for. */
export function SkeletonRows({ rows = 5, label = "Loading" }) {
  return (
    <div role="status" aria-live="polite" className="divide-y divide-line">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="hidden h-3.5 w-24 sm:block" />
          <Skeleton className="hidden h-3.5 w-16 md:block" />
        </div>
      ))}
    </div>
  );
}
