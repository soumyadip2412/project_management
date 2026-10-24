import { cn } from "../../lib/utils";

// Colour picked from the key, so a project keeps its colour everywhere.
const PALETTE = ["var(--primary)", "var(--info)", "var(--purple)", "var(--success)", "var(--warning)"];

export default function ProjectBadge({ project, size = "sm" }) {
  const key = project?.key ?? "";
  const index = [...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % PALETTE.length;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded font-mono font-medium text-surface",
        size === "lg" ? "h-8 w-8 text-[10px]" : "h-4 min-w-7 px-1 text-[9px]"
      )}
      style={{ background: PALETTE[index] }}
    >
      {key.slice(0, size === "lg" ? 3 : 4)}
    </span>
  );
}
