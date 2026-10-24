/**
 * FILE: frontend/src/lib/burndown.js
 *
 * Computes the data for the sprint burndown chart (components/project/SprintCharts.jsx).
 * A pure function (no React, no fetching), so it is easy to test.
 *
 * OUTPUT { days, total, ideal, actual }
 *   days    one Date per calendar day from sprint start to end
 *   total   story points in the sprint
 *   ideal   a straight line from `total` down to 0 across the sprint
 *   actual  points still remaining at the end of each day; null for future
 *           days, so the chart line stops at today
 *
 * Reading the chart: actual ABOVE ideal = behind schedule; below = ahead.
 */
const DAY = 86_400_000; // milliseconds in a day

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/**
 * Remaining story points per day of the sprint. The stored sprint snapshots
 * only exist at start and completion, so this is computed from the tasks:
 * a task's points burn on the day it was completed (its completedAt).
 */
export function computeBurndown(sprint, tasks, now = new Date()) {
  const start = startOfDay(sprint.startDate);
  let end = startOfDay(sprint.endDate);
  if (end < start) end = start;
  const days = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY) days.push(new Date(t));

  const total = tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
  const done = tasks
    .filter((t) => t.statusCategory === "done" && t.storyPoints)
    .map((t) => ({ at: new Date(t.completedAt ?? t.updatedAt).getTime(), points: t.storyPoints }));
  const today = startOfDay(now).getTime();

  // Linear interpolation from total (day 0) to 0 (last day), rounded to 1 decimal.
  const ideal = days.map((_, i) => (days.length > 1 ? Math.round(total * (1 - i / (days.length - 1)) * 10) / 10 : 0));
  // For each past or current day: total minus everything completed before
  // that day ended.
  const actual = days.map((d) => {
    if (d.getTime() > today) return null;
    const burned = done.filter((x) => x.at < d.getTime() + DAY).reduce((s, x) => s + x.points, 0);
    return total - burned;
  });
  return { days, total, ideal, actual };
}
