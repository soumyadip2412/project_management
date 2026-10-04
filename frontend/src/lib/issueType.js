import { BookOpen, Bug, CheckSquare, CornerDownRight, TrendingUp, Zap } from "lucide-react";

/**
 * Issue types. Mirrors `IssueTypeEnum` in backend/src/utils/constants.js;
 * backend/tests/issueType.test.js fails if the two drift.
 *
 * Colours are theme variables, used only on the small type glyph.
 */
export const ISSUE_TYPE_META = Object.freeze({
  epic: { label: "Epic", color: "var(--purple)", Icon: Zap },
  story: { label: "Story", color: "var(--success)", Icon: BookOpen },
  task: { label: "Task", color: "var(--info)", Icon: CheckSquare },
  bug: { label: "Bug", color: "var(--danger)", Icon: Bug },
  improvement: { label: "Improvement", color: "var(--warning)", Icon: TrendingUp },
  subtask: { label: "Subtask", color: "var(--text-subtlest)", Icon: CornerDownRight },
});

/** Types a person picks for a task (subtasks are created from their parent). */
export const PICKABLE_ISSUE_TYPES = Object.freeze(["task", "story", "bug", "improvement", "epic"]);

export const issueTypeMeta = (value) => ISSUE_TYPE_META[value] ?? ISSUE_TYPE_META.task;

/** Story points the API accepts: whole numbers 0–100, or none. */
export function parseStoryPoints(raw) {
  if (raw === "" || raw === null || raw === undefined) return { value: null };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 100) return { error: "Use a whole number from 0 to 100." };
  return { value: n };
}

