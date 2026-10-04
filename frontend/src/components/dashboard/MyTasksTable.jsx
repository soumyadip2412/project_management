import { useState } from "react";
import { Link } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { Panel, Segmented } from "../ui/Navigation";
import { DueDate, Key, PriorityBadge, StatusBadge } from "../ui/Display";
import { EmptyState } from "../ui/Feedback";
import { taskPath } from "../../lib/format";
import { useIsWide } from "../../lib/useMediaQuery";


/**
 * Work in flight across the caller's projects, from the dashboard pipeline
 * buckets the API returns (in progress / in review + QA / done).
 */
export default function MyTasksTable({
  inProgress,
  review,
  completed,
}) {
  const [tab, setTab] = useState("all");
  const isWide = useIsWide();

  const buckets = {
    all: [...inProgress, ...review, ...completed],
    in_progress: inProgress,
    review,
    completed,
  };
  const rows = buckets[tab];

  return (
    <Panel
      title="Recent work"
      action={
        <Segmented
          label="Show"
          value={tab}
          onChange={setTab}
          items={[
            { id: "all", label: `All ${buckets.all.length}` },
            { id: "in_progress", label: `In progress ${inProgress.length}` },
            { id: "review", label: `In review ${review.length}` },
            { id: "completed", label: `Done ${completed.length}` },
          ]}
        />
      }
      bodyClassName="px-4"
    >
      <div>
        {rows.length === 0 ? (
          <EmptyState icon={ListChecks} title="Nothing here" description="Tasks in this state will be listed here." />
        ) : isWide ? (
            <table className="w-full table-fixed text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-xs text-subtlest">
                  <th scope="col" className="py-2 pr-4 font-medium">Task</th>
                  <th scope="col" className="w-40 py-2 pr-4 font-medium">Project</th>
                  <th scope="col" className="w-32 py-2 pr-4 font-medium">Status</th>
                  <th scope="col" className="w-28 py-2 pr-4 font-medium">Priority</th>
                  <th scope="col" className="w-24 py-2 font-medium">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((t, i) => (
                  <tr key={t._id || i} className="group">
                    <td className="max-w-0 py-2.5 pr-4">
                      <Link to={taskPath(t)} className="flex min-w-0 items-center gap-2 rounded text-text group-hover:text-primary">
                        {t.issueKey && <Key>{t.issueKey}</Key>}
                        <span className="truncate font-medium">{t.title || t.name}</span>
                      </Link>
                    </td>
                    <td className="truncate py-2.5 pr-4 text-subtle">{t.project?.name || "—"}</td>
                    <td className="py-2.5 pr-4"><StatusBadge status={t.status} /></td>
                    <td className="py-2.5 pr-4"><PriorityBadge priority={t.priority} /></td>
                    <td className="py-2.5"><DueDate date={t.dueDate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
        ) : (
            <ul className="-mx-4 divide-y divide-line">
              {rows.map((t, i) => (
                <li key={t._id || i}>
                  <Link to={taskPath(t)} className="flex flex-col gap-1.5 px-4 py-3 hover:bg-surface-hover">
                    <span className="flex min-w-0 items-center gap-2">
                      {t.issueKey && <Key>{t.issueKey}</Key>}
                      <span className="truncate text-[13px] font-medium text-text">{t.title || t.name}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority} />
                      <DueDate date={t.dueDate} empty={null} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
        )}
      </div>
    </Panel>
  );
}
