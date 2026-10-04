import { statusMeta } from "../../lib/taskStatus";
import { priorityMeta } from "../../lib/priority";
import { issueTypeMeta } from "../../lib/issueType";
import { initialsOf } from "../../lib/format";
import { dueMeta } from "../../lib/time";
import { cn } from "../../lib/utils";

/* Read-only presentation of domain values. Colour lives in a small glyph and
   the text stays neutral, so a table full of statuses stays readable. */

export function StatusBadge({ status, className }) {
  const meta = statusMeta(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-subtle", className)}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Issue type as a small coloured glyph, named for screen readers. */
export function IssueTypeIcon({ type, size = 13 }) {
  const meta = issueTypeMeta(type);
  const Icon = meta.Icon;
  return <Icon size={size} style={{ color: meta.color }} role="img" aria-label={meta.label} className="shrink-0" />;
}

/** Story points, shown only when a task has them. */
export function Points({ value, className }) {
  if (value === null || value === undefined) return null;
  return (
    <span
      title={`${value} story points`}
      className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded bg-neutral-subtle px-1 text-[11px] font-medium tabular-nums text-subtle", className)}
    >
      {value}
      <span className="sr-only"> story points</span>
    </span>
  );
}

export function PriorityBadge({ priority, className }) {
  const meta = priorityMeta(priority);
  const Icon = meta.Icon;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-[13px] text-subtle", className)}>
      <Icon size={14} style={{ color: meta.color }} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Neutral label for roles and other categorical values. */
export function Tag({ children, tone = "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center whitespace-nowrap rounded px-1.5 text-xs font-medium",
        tone === "accent" ? "bg-primary-subtle text-primary" : "bg-neutral-subtle text-subtle"
      )}
    >
      {children}
    </span>
  );
}

/** Issue and project keys are identifiers people copy and type, so they are set in mono. */
export function Key({ children, className }) {
  return <span className={cn("whitespace-nowrap font-mono text-xs text-subtlest", className)}>{children}</span>;
}

export function Avatar({ name, size = "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-subtle font-medium text-subtle",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs"
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Thin progress bar with its value stated in text next to it. */
export function Progress({ value, label }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover"
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Due date, relative and coloured by urgency ("3d overdue", "Today", "in 5d",
 * "12 Oct"). Used everywhere a due date appears, so it always reads the same.
 */
export function DueDate({ date, empty = "—", className }) {
  const due = dueMeta(date);
  if (!due) return empty ? <span className={cn("text-[13px] text-subtlest", className)}>{empty}</span> : null;
  return (
    <time
      dateTime={date ?? undefined}
      title={new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
      className={cn(
        "whitespace-nowrap text-[13px]",
        due.overdue ? "font-medium text-danger" : due.soon ? "font-medium text-warning" : "text-subtle",
        className
      )}
    >
      {due.label}
    </time>
  );
}
