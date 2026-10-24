import { nameOf } from "./format.js";

/** Board swimlanes and WIP decoration. Pure, so it is unit-tested under Node. */
export const UNASSIGNED = "unassigned";

const idOf = (user) => (typeof user === "object" ? user?._id : user);

/**
 * One lane per first assignee. An issue appears exactly once (in its first
 * assignee's lane), so points are never counted twice.
 */
export function groupIntoLanes(tasks) {
  const lanes = new Map();
  for (const task of tasks) {
    const user = task.assignees?.[0] ?? null;
    const key = idOf(user) ?? UNASSIGNED;
    if (!lanes.has(key)) {
      lanes.set(key, { key, label: user ? nameOf(user) : "Unassigned", user, tasks: [], points: 0 });
    }
    const lane = lanes.get(key);
    lane.tasks.push(task);
    lane.points += task.storyPoints ?? 0;
  }
  return [...lanes.values()].sort((a, b) => {
    if (a.key === UNASSIGNED) return 1;
    if (b.key === UNASSIGNED) return -1;
    return a.label.localeCompare(b.label);
  });
}

/** A limit of 0 (or none) means "no limit". Over the limit is a warning, never a block. */
export function wipState(count, limit) {
  if (!limit) return { limited: false, over: false, label: String(count) };
  return { limited: true, over: count > limit, label: `${count} / ${limit}` };
}
