import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { Panel } from "../ui/Navigation";
import { Key } from "../ui/Display";
import { EmptyState } from "../ui/Feedback";
import { dueMeta } from "../../lib/time";
import { taskPath } from "../../lib/format";
import { cn } from "../../lib/utils";

/** The soonest-due open tasks. Tasks without a due date are left out. */
export default function UpcomingDeadlines({ tasks }) {
  const upcoming = tasks
    .filter((t) => t.dueDate)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 6);

  return (
    <Panel title="Due soon">
      {upcoming.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Nothing due" description="Open tasks with a due date are listed here." className="py-8" />
      ) : (
        <ul className="divide-y divide-line">
          {upcoming.map((t, i) => {
            const due = dueMeta(t.dueDate);
            return (
              <li key={t._id || i}>
                <Link to={taskPath(t)} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-hover">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-text">{t.title || t.name}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-subtlest">
                      {t.issueKey && <Key>{t.issueKey}</Key>}
                      <span className="truncate">{t.project?.name}</span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-medium",
                      due.overdue ? "text-danger" : due.soon ? "text-warning" : "text-subtle"
                    )}
                  >
                    {due.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
