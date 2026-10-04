import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { Panel } from "../ui/Navigation";
import { Key, Progress } from "../ui/Display";
import { EmptyState } from "../ui/Feedback";

/**
 * Completed vs. total tasks per project — real counts from the dashboard API.
 * (There is no time-series endpoint, so no over-time chart is drawn.)
 */
export default function WorkProgressChart({ projects }) {
  const withTasks = projects.filter((p) => (p.totalTasks ?? 0) > 0);

  return (
    <Panel
      title="Progress by project"
      action={
        <Link to="/dashboard/projects" className="rounded text-xs font-medium text-primary hover:underline">
          All projects
        </Link>
      }
      bodyClassName="p-4"
    >
      {withTasks.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No tasks to measure yet"
          description="Progress appears once your projects have tasks."
          className="py-8"
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {withTasks.map((p, i) => {
            const total = p.totalTasks ?? 0;
            const done = p.completedTasks ?? 0;
            const pct = p.progress ?? (total > 0 ? Math.round((done / total) * 100) : 0);
            return (
              <li key={p._id || i}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                  <Link to={`/dashboard/projects/${p._id}`} className="flex min-w-0 items-baseline gap-2 rounded text-text hover:text-primary">
                    {p.key && <Key>{p.key}</Key>}
                    <span className="truncate font-medium">{p.name}</span>
                  </Link>
                  <span className="shrink-0 text-xs tabular-nums text-subtle">
                    {done} of {total} done
                  </span>
                </div>
                <Progress value={pct} label={`${p.name}: ${pct}% of tasks done`} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
