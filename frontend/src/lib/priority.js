import { ChevronUp, ChevronsUp, Minus, ChevronDown, AlertTriangle } from "lucide-react";

/**
 * Task priority presentation. Mirrors `PriorityEnum` in
 * `backend/src/utils/constants.js` (critical / high / medium / low / none).
 *
 * Colours are CSS-variable references so they follow the active light/dark theme.
 */

/** Values the API accepts, highest first (for selects and filters). */
export const PRIORITY_VALUES = Object.freeze(["critical", "high", "medium", "low", "none"]);

const PRIORITY_META = {
  critical: { label: "Critical", color: "var(--danger)", Icon: AlertTriangle },
  high: { label: "High", color: "var(--warning)", Icon: ChevronsUp },
  medium: { label: "Medium", color: "var(--info)", Icon: ChevronUp },
  low: { label: "Low", color: "var(--text-subtlest)", Icon: ChevronDown },
  none: { label: "None", color: "var(--text-subtlest)", Icon: Minus },
};

export function priorityMeta(value) {
  const key = String(value ?? "none").toLowerCase();
  return PRIORITY_META[key] ?? PRIORITY_META.none;
}
