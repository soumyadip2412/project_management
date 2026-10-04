const DAY = 86_400_000;

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

  const ideal = days.map((_, i) => (days.length > 1 ? Math.round(total * (1 - i / (days.length - 1)) * 10) / 10 : 0));
  const actual = days.map((d) => {
    if (d.getTime() > today) return null;
    const burned = done.filter((x) => x.at < d.getTime() + DAY).reduce((s, x) => s + x.points, 0);
    return total - burned;
  });
  return { days, total, ideal, actual };
}
