import { computeBurndown } from "../../lib/burndown";
import { formatDate } from "../../lib/format";
import { daySegments, HEALTH_META, sprintHealth } from "../../lib/sprintHealth";
import { cn } from "../../lib/utils";

const TONE = {
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
};

export function HealthLozenge({ health }) {
  if (!health) return null;
  const meta = HEALTH_META[health];
  return (
    <span className={cn("inline-flex h-5 items-center whitespace-nowrap rounded-[3px] px-1.5 text-[10.5px] font-bold uppercase tracking-[0.03em]", TONE[meta.tone])}>
      {meta.label}
    </span>
  );
}

/** One segment per sprint day (bucketed above 20): elapsed teal, today ringed, future grey. */
export function DayBar({ totalDays, dayIndex, compact = false }) {
  const segments = daySegments(totalDays, dayIndex);
  return (
    <span
      aria-hidden="true"
      className="grid gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
    >
      {segments.map((s, i) => (
        <span
          key={i}
          className={cn(
            "rounded-[2px]",
            compact ? "h-[5px]" : "h-2",
            s === "future" ? "bg-line" : "bg-primary",
            s === "today" && "shadow-[0_0_0_2px_var(--primary-subtle),0_0_0_3px_var(--primary)]"
          )}
        />
      ))}
    </span>
  );
}

function Sparkline({ sprint, issues }) {
  const { ideal, actual, total } = computeBurndown(sprint, issues);
  if (total === 0 || ideal.length < 2) return null;
  const w = 78;
  const h = 22;
  const x = (i) => (i / (ideal.length - 1)) * w;
  const y = (v) => 2 + (1 - v / total) * (h - 4);
  const points = (values) =>
    values.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="block">
      <polyline points={points(ideal)} fill="none" stroke="var(--chart-reference)" strokeDasharray="3 3" strokeWidth="1.5" />
      <polyline points={points(actual)} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The signature strip on Board, Backlog and Summary: where the sprint is in
 * time, how much is left, scope added since it started, and its health.
 */
export default function SprintTide({ sprint, issues, action = null }) {
  const h = sprintHealth(sprint, issues);
  const unitWord = h.unit === "pts" ? "points" : "issues";
  const sentence =
    `${sprint.name}, day ${h.dayIndex} of ${h.totalDays}, ${h.remaining} of ${h.total} ${unitWord} left` +
    (h.added > 0 ? `, ${h.added} ${unitWord} added since the start` : "") +
    (h.health ? `, ${HEALTH_META[h.health].label.toLowerCase()}` : "");

  return (
    <section
      role="group"
      aria-label={sentence}
      className="mb-4 grid items-center gap-x-5 gap-y-3 rounded-md border border-line bg-surface px-4 py-3 shadow-card md:grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto_auto]"
    >
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-text">{sprint.name}</p>
        {sprint.goal && <p className="truncate text-xs text-subtlest">{sprint.goal}</p>}
      </div>
      <div className="min-w-0">
        <DayBar totalDays={h.totalDays} dayIndex={h.dayIndex} />
        <p className="mt-1.5 flex justify-between gap-2 text-xs text-subtlest">
          <span>{formatDate(sprint.startDate)}</span>
          <span className="text-center">
            <b className="font-semibold text-text">Day {h.dayIndex} of {h.totalDays}</b> · {h.remaining} of {h.total} {h.unit} left
            {h.added > 0 && <span className="text-warning"> · +{h.added} {h.unit} added</span>}
          </span>
          <span>{formatDate(sprint.endDate)}</span>
        </p>
      </div>
      <div className="flex items-center gap-3 md:flex-col md:items-end md:gap-1">
        <HealthLozenge health={h.health} />
        <Sparkline sprint={sprint} issues={issues} />
      </div>
      {action && <div>{action}</div>}
    </section>
  );
}
