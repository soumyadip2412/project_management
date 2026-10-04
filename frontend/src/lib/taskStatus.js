import { AlertCircle, Ban, CheckCircle2, CheckSquare, Clock, Inbox } from "lucide-react";

/**
 * ─── Canonical task statuses ──────────────────────────────────────────────────
 *
 * This is the single source of task-status values for the whole frontend.
 *
 * It MUST stay identical to `TaskStatusEnum` in `backend/src/utils/constants.js`,
 * which backs the `status` field's schema enum on the Task model. Sending any
 * other value fails Mongoose validation and the API returns 400.
 *
 * Do not add a status here without adding it to the backend enum first, and do
 * not redeclare these strings anywhere else in the frontend.
 */
export const TASK_STATUS = Object.freeze({
  BACKLOG: "backlog",
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  IN_REVIEW: "in_review",
  QA_TESTING: "qa_testing",
  DONE: "done",
  CANCELLED: "cancelled",
});

export const TASK_STATUS_VALUES = Object.freeze(Object.values(TASK_STATUS));

/**
 * Presentation for each canonical status. Colours are theme variables and are
 * used only on the small status glyph, never as fills. Open states are grey,
 * active work is blue, review/QA are violet/amber, closed states green/grey.
 */
export const STATUS_META = {
  [TASK_STATUS.BACKLOG]: { label: "Backlog", color: "var(--border-strong)", Icon: Inbox },
  [TASK_STATUS.TODO]: { label: "To Do", color: "var(--text-subtlest)", Icon: CheckSquare },
  [TASK_STATUS.IN_PROGRESS]: { label: "In Progress", color: "var(--info)", Icon: Clock },
  [TASK_STATUS.IN_REVIEW]: { label: "In Review", color: "var(--purple)", Icon: AlertCircle },
  [TASK_STATUS.QA_TESTING]: { label: "QA Testing", color: "var(--warning)", Icon: AlertCircle },
  [TASK_STATUS.DONE]: { label: "Done", color: "var(--success)", Icon: CheckCircle2 },
  [TASK_STATUS.CANCELLED]: { label: "Cancelled", color: "var(--border-strong)", Icon: Ban },
};

/**
 * Board columns, left to right.
 *
 * Every canonical status appears exactly once, deliberately: a status missing
 * from the board makes tasks holding it invisible. `backlog` in particular is
 * set by the backend whenever a task is pulled out of a sprint
 * (see sprint.controller.js), so omitting it silently hid real tasks.
 */
export const BOARD_COLUMNS = Object.freeze([
  TASK_STATUS.BACKLOG,
  TASK_STATUS.TODO,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.IN_REVIEW,
  TASK_STATUS.QA_TESTING,
  TASK_STATUS.DONE,
  TASK_STATUS.CANCELLED,
]);

export function isTaskStatus(value) {
  return typeof value === "string" && TASK_STATUS_VALUES.includes(value);
}

/**
 * Presentation for a status coming off the API. Unrecognised values (legacy rows,
 * or a status added to the backend but not yet here) fall back to a neutral
 * label rather than crashing on an undefined lookup.
 */
export function statusMeta(value) {
  if (isTaskStatus(value)) return STATUS_META[value];
  return { label: String(value ?? "Unknown"), color: "var(--text-subtlest)", Icon: AlertCircle };
}

/**
 * Replaces raw status keys in server-written text ("moved PAY-5 from
 * in_progress to in_review") with their labels ("In Progress" → "In Review").
 */
export function humanizeStatuses(text) {
  return text.replace(/\b(backlog|todo|in_progress|in_review|qa_testing|done|cancelled)\b/g, (key) =>
    isTaskStatus(key) ? STATUS_META[key].label : key
  );
}
