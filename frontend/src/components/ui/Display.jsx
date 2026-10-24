import { STATUS_TONE, statusMeta } from "../../lib/taskStatus";
import { priorityMeta } from "../../lib/priority";
import { issueTypeMeta } from "../../lib/issueType";
import { initialsOf } from "../../lib/format";
import { dueMeta } from "../../lib/time";
import { cn } from "../../lib/utils";

/* FILE: frontend/src/components/ui/Display.jsx

   Read-only presentation of domain values. Statuses are tinted lozenges;
   issue types are filled squares, so a table full of statuses stays readable.

   Exports: StatusBadge, IssueTypeIcon, Points, PriorityBadge, Tag, Key,
   Avatar, Progress, DueDate. Each one takes a raw API value and asks the
   matching lib/* helper how to show it, so every page renders a status or a
   priority identically.

   Accessibility patterns used here:
   - Decorative glyphs get aria-hidden="true"; meaningful icons get role="img"
     plus an aria-label.
   - `sr-only` text (visually hidden, read by screen readers) adds context
     such as "story points".
   - Progress uses role="progressbar" with aria-valuenow/min/max.
   - Inline `style` is used only for truly dynamic values (a colour from a
     lookup, a width in %). */

/** A tinted lozenge with the human label for a task status ("in_review" → "In Review"). */
export function StatusBadge({ status, className }) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center whitespace-nowrap rounded-[3px] px-1.5 text-[10.5px] font-bold uppercase tracking-[0.03em]",
        STATUS_TONE[status] ?? STATUS_TONE.todo,
        className
      )}
    >
      {meta.label}
    </span>
  );
}

// A filled square in the type colour with the glyph knocked out in the
// surface colour: white on dark squares in light mode, dark on light squares
// in dark mode, so it reads in both themes.
export function IssueTypeIcon({ type, size = 14 }) {
  const meta = issueTypeMeta(type);
  const Icon = meta.Icon;
  return (
    <span
      role="img"
      aria-label={meta.label}
      className="inline-grid shrink-0 place-items-center rounded-[3px] text-surface"
      style={{ width: size, height: size, background: meta.color }}
    >
      <Icon size={Math.round(size * 0.7)} strokeWidth={2.5} aria-hidden="true" />
    </span>
  );
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

/** Initials in a circle. aria-hidden because the name is always shown as text next to it. */
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
