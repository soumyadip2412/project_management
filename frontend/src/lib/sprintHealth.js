/**
 * Sprint progress and health, computed only from stored data.
 * Pure (no React, no imports), so `npm test` runs it under plain Node.
 *
 * Days are local calendar days, counted inclusively: a sprint from Oct 18 to
 * Oct 27 has 10 days, and Oct 23 is day 6.
 */
const DAY_MS = 86_400_000;

const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Math.round absorbs the 23- and 25-hour days around a daylight-saving change.
const daysBetween = (from, to) => Math.round((to - from) / DAY_MS);

export const HEALTH_META = Object.freeze({
  on_track: { label: "On track", tone: "success" },
  at_risk: { label: "At risk", tone: "warning" },
  off_track: { label: "Off track", tone: "danger" },
  overdue: { label: "Overdue", tone: "danger" },
});

/**
 * @param sprint  { startDate, endDate }
 * @param totals  { unit: "pts"|"issues", total, remaining, startTotal: number|null }
 */
export function sprintHealthFromTotals(sprint, { unit, total, remaining, startTotal }, now = new Date()) {
  const start = startOfDay(sprint.startDate);
  const end = startOfDay(sprint.endDate);
  const today = startOfDay(now);

  const totalDays = Math.max(1, daysBetween(start, end) + 1);
  const dayIndex = today < start ? 0 : Math.min(totalDays, daysBetween(start, today) + 1);
  const added = startTotal == null ? 0 : Math.max(0, total - startTotal);
  const idealRemaining = total * (1 - dayIndex / totalDays);

  let health = null;
  if (total > 0) {
    if (today > end && remaining > 0) {
      health = "overdue";
    } else {
      const gap = (remaining - idealRemaining) / total;
      // Small epsilon: 0.1 computed from floats must still count as "on track".
      health = gap <= 0.1 + 1e-9 ? "on_track" : gap <= 0.25 + 1e-9 ? "at_risk" : "off_track";
    }
  }

  return { totalDays, dayIndex, unit, total, remaining, added, idealRemaining, health };
}

/**
 * @param sprint  { startDate, endDate, burndownData?: [{ totalPoints }], summary?: { totalIssues } }
 * @param issues  [{ storyPoints, statusCategory }]
 */
export function sprintHealth(sprint, issues, now = new Date()) {
  const pointsMode = issues.some((i) => (i.storyPoints ?? 0) > 0);
  const weight = (i) => (pointsMode ? i.storyPoints ?? 0 : 1);
  const total = issues.reduce((sum, i) => sum + weight(i), 0);
  const remaining = issues.filter((i) => i.statusCategory !== "done").reduce((sum, i) => sum + weight(i), 0);

  // The backend snapshots the sprint when it starts: points in burndownData[0],
  // the issue count in summary.totalIssues.
  const snapshot = sprint.burndownData?.[0];
  const startTotal = pointsMode ? snapshot?.totalPoints ?? null : snapshot ? sprint.summary?.totalIssues ?? null : sprint.summary?.totalIssues ?? null;

  return sprintHealthFromTotals(sprint, { unit: pointsMode ? "pts" : "issues", total, remaining, startTotal }, now);
}

/** One entry per day (or proportional buckets when the sprint is longer than `max`). */
export function daySegments(totalDays, dayIndex, max = 20) {
  const n = Math.min(totalDays, max);
  const todayAt = dayIndex === 0 ? -1 : Math.ceil((dayIndex / totalDays) * n) - 1;
  return Array.from({ length: n }, (_, i) => (i < todayAt ? "past" : i === todayAt ? "today" : "future"));
}
