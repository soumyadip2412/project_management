import { Link } from "react-router-dom";
import { FolderKanban } from "lucide-react";
import { Panel } from "../ui/Navigation";
import { Key } from "../ui/Display";
import { EmptyState } from "../ui/Feedback";

/** Most recently updated projects, one compact row each. */
export default function ActiveProjects({ projects }) {
  const list = projects.slice(0, 5);

  return (
    <Panel
      title="Recently updated projects"
      action={
        <Link to="/dashboard/projects" className="rounded text-xs font-medium text-primary hover:underline">
          All projects
        </Link>
      }
    >
      {list.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" description="Create a project to start tracking work." className="py-8" />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((p, i) => {
            const total = p.totalTasks ?? 0;
            const people = Array.isArray(p.members) ? p.members.length : 0;
            return (
              <li key={p._id || i}>
                <Link to={`/dashboard/projects/${p._id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover">
                  <Key className="w-16 shrink-0 truncate">{p.key}</Key>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{p.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-subtlest">
                    {total} {total === 1 ? "task" : "tasks"}
                    {people > 0 && `, ${people} ${people === 1 ? "person" : "people"}`}
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
