// FILE: frontend/src/lib/time.js
// Date helpers for the UI: relative times ("3h ago") and due-date badges.
// Days are compared at local midnight, so "Tomorrow" means the calendar day,
// not "24 hours from now".

/** Compact "time ago" for activity feeds. Returns "just now", "5m", "3h", "2d", or a date. */
export function timeAgo(input) {
  if (!input) return "";
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(input).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Human-friendly due date with overdue / soon flags for colour coding.
 * `closed`: the issue is done or cancelled, so its date is history, not a deadline.
 */
export function dueMeta(input, { closed = false } = {}) {
  if (!input) return null;
  const due = new Date(input);
  if (Number.isNaN(due.getTime())) return null;
  if (closed) {
    return { label: due.toLocaleDateString(undefined, { month: "short", day: "numeric" }), overdue: false, soon: false };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDue = new Date(due);
  startOfDue.setHours(0, 0, 0, 0);

  const dayMs = 86_400_000;
  const days = Math.round((startOfDue.getTime() - startOfToday.getTime()) / dayMs);

  if (days < 0) return { label: `${Math.abs(days)}d overdue`, overdue: true, soon: false };
  if (days === 0) return { label: "Today", overdue: false, soon: true };
  if (days === 1) return { label: "Tomorrow", overdue: false, soon: true };
  if (days < 7) return { label: `in ${days}d`, overdue: false, soon: false };
  return {
    label: due.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    overdue: false,
    soon: false,
  };
}
