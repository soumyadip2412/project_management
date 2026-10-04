import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { CheckSquare, Plus } from "lucide-react";
import { api } from "../../lib/api";
import CreateTaskModal from "../CreateTaskModal";
import { Button } from "../ui/Button";
import { Alert, EmptyState, SkeletonRows } from "../ui/Feedback";
import { DueDate, Key, PriorityBadge, StatusBadge } from "../ui/Display";
import { useToast } from "../ui/Toast";
import { nameOf, taskPath } from "../../lib/format";
import { useIsWide } from "../../lib/useMediaQuery";

/** This project's tasks (first 100, newest first). */
export default function ProjectTasks({ project }) {
  const toast = useToast();
  const isWide = useIsWide();
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/tasks/${project._id}`, { params: { limit: 100 } });
      // The endpoint returns { tasks, totalTasks, ... }, not a bare array.
      setTasks(Array.isArray(res?.data?.tasks) ? res.data.tasks : []);
      setTotal(res?.data?.totalTasks ?? 0);
    } catch (err) {
      setError(err?.message || "Tasks could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [project._id]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Links from this tab carry the project so the task page can load.
  const withProject = (t) => ({ ...t, project: t.project ?? project._id });

  return (
    <section aria-labelledby="project-tasks-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="project-tasks-heading" className="text-[13px] font-semibold text-text">
          Tasks <span className="font-normal text-subtlest">{total}</span>
        </h2>
        <div className="flex items-center gap-3">
          <Link to={`/dashboard/tasks?project=${project._id}`} className="rounded text-xs font-medium text-primary hover:underline">
            Open on the board
          </Link>
          <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            New task
          </Button>
        </div>
      </div>

      {error && (
        <Alert className="mb-3">
          {error}{" "}
          <button type="button" onClick={fetchTasks} className="font-medium underline">Try again</button>
        </Alert>
      )}

      <div className="rounded-lg border border-line bg-surface">
        {loading ? (
          <SkeletonRows label="Loading tasks" />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No tasks in this project"
            description="Add the first task to start tracking work here."
            action={<Button size="sm" onClick={() => setCreateOpen(true)}>Create task</Button>}
          />
        ) : isWide ? (
          <table className="w-full table-fixed text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-subtlest">
                <th scope="col" className="w-24 py-2 pl-4 pr-3 font-medium">Key</th>
                <th scope="col" className="py-2 pr-3 font-medium">Title</th>
                <th scope="col" className="w-32 py-2 pr-3 font-medium">Status</th>
                <th scope="col" className="w-28 py-2 pr-3 font-medium">Priority</th>
                <th scope="col" className="hidden w-36 py-2 pr-3 font-medium lg:table-cell">Assignee</th>
                <th scope="col" className="w-24 py-2 pr-4 font-medium">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tasks.map((t) => (
                <tr key={t._id} className="group hover:bg-surface-raised">
                  <td className="py-2.5 pl-4 pr-3"><Key>{t.issueKey}</Key></td>
                  <td className="max-w-0 py-2.5 pr-3">
                    <Link to={taskPath(withProject(t))} className="block truncate rounded font-medium text-text group-hover:text-primary">
                      {t.title}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3"><StatusBadge status={t.status} /></td>
                  <td className="py-2.5 pr-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="hidden truncate py-2.5 pr-3 text-subtle lg:table-cell">
                    {t.assignees?.[0] ? nameOf(t.assignees[0]) : <span className="text-subtlest">Unassigned</span>}
                  </td>
                  <td className="py-2.5 pr-4"><DueDate date={t.dueDate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="divide-y divide-line">
            {tasks.map((t) => (
              <li key={t._id}>
                <Link to={taskPath(withProject(t))} className="block px-4 py-2.5 hover:bg-surface-hover">
                  <span className="flex items-center gap-2">
                    <Key>{t.issueKey}</Key>
                    <span className="truncate text-[13px] font-medium text-text">{t.title}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
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
      {total > tasks.length && (
        <p className="mt-2 text-xs text-subtlest">
          Showing the {tasks.length} newest of {total}. <Link to="/dashboard/tasks" className="text-primary hover:underline">Open the Tasks page</Link> to filter all of them.
        </p>
      )}

      <CreateTaskModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultProjectId={project._id}
        onSuccess={(task) => {
          toast(task?.issueKey ? `Task ${task.issueKey} created` : "Task created");
          fetchTasks();
        }}
      />
    </section>
  );
}
