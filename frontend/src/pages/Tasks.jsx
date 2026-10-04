import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckSquare, Columns3, ExternalLink, List, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { BOARD_COLUMNS, STATUS_META, isTaskStatus, statusMeta } from "../lib/taskStatus";
import { api } from "../lib/api";
import CreateTaskModal from "../components/CreateTaskModal";
import CreateProjectModal from "../components/CreateProjectModal";
import { Menu, PageHeader, Segmented, SortHeader } from "../components/ui/Navigation";
import { Button, IconButton } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Field";
import { Alert, EmptyState, SkeletonRows } from "../components/ui/Feedback";
import { ConfirmDialog } from "../components/ui/Modal";
import { DueDate, Key, PriorityBadge } from "../components/ui/Display";
import { useToast } from "../components/ui/Toast";
import { nameOf, projectIdOf, taskPath } from "../lib/format";
import { cn } from "../lib/utils";
import { useIsWide } from "../lib/useMediaQuery";
import TaskBoard from "../components/tasks/TaskBoard";


const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };

// ═══════════════════════════════════════════════════════════════════════════════
export default function Tasks() {
  const toast = useToast();
  const navigate = useNavigate();
  const isWide = useIsWide();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [searchParams] = useSearchParams();
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get("project") || "all");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState("board");
  const [actionError, setActionError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchTasksAndProjects = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const projRes = await api.get("/projects");
      const validProjects = Array.isArray(projRes?.data) ? projRes.data : [];
      setProjects(validProjects);

      // Every page of every project's tasks. Projects are fetched in parallel;
      // pages within one project follow each other (each reply says how many remain).
      const perProject = await Promise.all(
        validProjects.map(async (p) => {
          const collected = [];
          try {
            for (let page = 1, totalPages = 1; page <= totalPages; page++) {
              const taskRes = await api.get(`/tasks/${p._id}`, { params: { page, limit: 100 } });
              const pTasks = taskRes?.data?.tasks ?? [];
              totalPages = taskRes?.data?.totalPages || 1;
              collected.push(...pTasks.map((t) => ({ ...t, project: { _id: p._id, name: p.name, key: p.key } })));
            }
          } catch {
            // One unreadable project should not blank the whole board.
          }
          return collected;
        })
      );
      setTasks(perProject.flat());
    } catch (err) {
      setLoadError(err?.message || "Tasks could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasksAndProjects();
  }, [fetchTasksAndProjects]);

  const handleStatusChange = async (taskId, projectId, newStatus) => {
    const previousTasks = tasks;
    // Optimistic update; reverted (and explained) if the server refuses.
    setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)));
    setActionError(null);
    try {
      if (projectId) await api.put(`/tasks/${projectId}/t/${taskId}`, { status: newStatus });
    } catch (err) {
      setTasks(previousTasks);
      setActionError(`${err?.message || "The status could not be changed."} The task was moved back.`);
    }
  };

  const handleDeleteTask = async () => {
    const task = deleteTarget;
    await api.delete(`/tasks/${projectIdOf(task)}/t/${task._id}`);
    setTasks((prev) => prev.filter((t) => t._id !== task._id));
    toast(`Task ${task.issueKey} deleted`);
  };

  const moveTask = (task, status) => {
    if (isTaskStatus(status) && task.status !== status) handleStatusChange(task._id, projectIdOf(task), status);
  };

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((t) => {
      const matchesProject = selectedProjectId === "all" || projectIdOf(t) === selectedProjectId;
      const matchesSearch =
        !term ||
        t.title?.toLowerCase().includes(term) ||
        t.issueKey?.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term);
      const matchesStatus = viewMode === "board" || statusFilter === "all" || t.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchesProject && matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, selectedProjectId, search, statusFilter, priorityFilter, viewMode]);

  const onSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const listTasks = useMemo(() => {
    if (!sort.key) return filteredTasks;
    const dir = sort.dir === "asc" ? 1 : -1;
    const value = (t) => {
      switch (sort.key) {
        case "key": return t.issueKey ?? "";
        case "priority": return PRIORITY_RANK[t.priority] ?? 5;
        case "status": return BOARD_COLUMNS.indexOf(t.status);
        default: return t.dueDate ? new Date(t.dueDate).getTime() : Number.POSITIVE_INFINITY;
      }
    };
    return [...filteredTasks].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = typeof va === "string" ? va.localeCompare(String(vb), undefined, { numeric: true }) : va - vb;
      return dir * cmp;
    });
  }, [filteredTasks, sort]);

  const rowActions = (task) => [
    { label: "Open task", icon: ExternalLink, onSelect: () => navigate(taskPath(task)) },
    { label: "Delete task", icon: Trash2, tone: "danger", onSelect: () => setDeleteTarget(task) },
  ];

  const filtersActive =
    search.trim() !== "" || selectedProjectId !== "all" || priorityFilter !== "all" || (viewMode === "list" && statusFilter !== "all");

  const clearFilters = () => {
    setSearch("");
    setSelectedProjectId("all");
    setStatusFilter("all");
    setPriorityFilter("all");
  };

  const body = () => {
    if (loading && tasks.length === 0) {
      return (
        <section className="rounded-lg border border-line bg-surface">
          <SkeletonRows label="Loading tasks" />
        </section>
      );
    }
    if (tasks.length === 0) {
      return (
        <section className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={CheckSquare}
            title={projects.length === 0 ? "Create a project first" : "No tasks yet"}
            description={
              projects.length === 0
                ? "Tasks live inside projects. Once you have a project, its tasks appear here."
                : "Add a task to start tracking work across your projects."
            }
            action={
              projects.length > 0 ? (
                <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setIsModalOpen(true)}>
                  Create task
                </Button>
              ) : (
                <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setIsProjectModalOpen(true)}>
                  Create project
                </Button>
              )
            }
          />
        </section>
      );
    }
    if (viewMode === "list" && filteredTasks.length === 0) {
      return (
        <section className="rounded-lg border border-line bg-surface">
          <EmptyState icon={Search} title="No tasks match these filters" action={<Button size="sm" onClick={clearFilters}>Clear filters</Button>} />
        </section>
      );
    }

    if (viewMode === "board") {
      return <TaskBoard tasks={filteredTasks} onMove={moveTask} />;
    }

    // ── List view ──
    const statusSelect = (task) => (
      <select
        aria-label={`Status of ${task.issueKey}`}
        value={task.status || "todo"}
        onChange={(e) => {
          const next = e.target.value;
          if (isTaskStatus(next)) handleStatusChange(task._id, projectIdOf(task), next);
        }}
        className="h-7 cursor-pointer rounded border border-transparent bg-transparent pr-6 text-[13px] text-subtle hover:border-line focus:border-primary focus:outline-none pointer-coarse:h-9"
      >
        {BOARD_COLUMNS.map((key) => (
          <option key={key} value={key}>
            {STATUS_META[key].label}
          </option>
        ))}
      </select>
    );

    return (
      <section className="rounded-lg border border-line bg-surface">
        {isWide ? (
          <table className="w-full table-fixed text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-subtlest">
                <SortHeader label="Key" column="key" sort={sort} onSort={onSort} className="w-24 pl-4" />
                <th scope="col" className="py-2 pr-3 font-medium">Task</th>
                <th scope="col" className="hidden w-36 py-2 pr-3 font-medium lg:table-cell">Assignee</th>
                <SortHeader label="Priority" column="priority" sort={sort} onSort={onSort} className="w-28" />
                <SortHeader label="Status" column="status" sort={sort} onSort={onSort} className="w-40" />
                <SortHeader label="Due" column="due" sort={sort} onSort={onSort} className="w-28" />
                <th scope="col" className="w-10 py-2 pr-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {listTasks.map((task) => (
                <tr key={task._id} className="group hover:bg-surface-raised">
                  <td className="py-1.5 pl-4 pr-3"><Key>{task.issueKey}</Key></td>
                  <td className="max-w-0 py-1.5 pr-3">
                    <Link to={taskPath(task)} className="block truncate rounded font-medium text-text group-hover:text-primary">
                      {task.title}
                    </Link>
                    <span className="block truncate text-xs text-subtlest">{task.project?.name}</span>
                  </td>
                  <td className="hidden truncate py-1.5 pr-3 text-subtle lg:table-cell">
                    {task.assignees?.[0] ? nameOf(task.assignees[0]) : <span className="text-subtlest">Unassigned</span>}
                  </td>
                  <td className="py-1.5 pr-3"><PriorityBadge priority={task.priority} /></td>
                  <td className="py-1.5 pr-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusMeta(task.status).color }} aria-hidden="true" />
                      {statusSelect(task)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3"><DueDate date={task.dueDate} /></td>
                  <td className="py-1.5 pr-2 text-right">
                    <Menu label={`Actions for ${task.issueKey}`} items={rowActions(task)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="divide-y divide-line">
            {listTasks.map((task) => (
              <li key={task._id} className="px-4 py-2.5">
                <div className="flex items-start gap-2">
                  <Link to={taskPath(task)} className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Key>{task.issueKey}</Key>
                      <span className="truncate text-[13px] font-medium text-text">{task.title}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-subtlest">{task.project?.name}</span>
                  </Link>
                  <Menu label={`Actions for ${task.issueKey}`} items={rowActions(task)} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3">
                  {statusSelect(task)}
                  <PriorityBadge priority={task.priority} />
                  <DueDate date={task.dueDate} empty={null} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  return (
    <>
      <PageHeader
        title="Tasks"
        description={viewMode === "board" ? "All tasks across your projects. Drag a card, or use its menu, to change its status." : "All tasks across your projects."}
        actions={
          <>
            <Segmented
              label="View"
              value={viewMode}
              onChange={setViewMode}
              items={[
                { id: "board", label: "Board", icon: Columns3 },
                { id: "list", label: "List", icon: List },
              ]}
            />
            <IconButton label="Refresh" onClick={fetchTasksAndProjects} disabled={loading} className="border-line bg-surface">
              <RefreshCw size={14} className={loading ? "animate-spin" : undefined} />
            </IconButton>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setIsModalOpen(true)}>
              New task
            </Button>
          </>
        }
      />

      <div className={cn("mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", !loading && projects.length === 0 && "hidden")}>
        <div className="relative sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtlest" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Filter tasks"
            placeholder="Filter by title or key"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select aria-label="Project" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="sm:w-44">
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
          {viewMode === "list" && (
            <Select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-36">
              <option value="all">All statuses</option>
              {BOARD_COLUMNS.map((key) => (
                <option key={key} value={key}>
                  {STATUS_META[key].label}
                </option>
              ))}
            </Select>
          )}
          <Select aria-label="Priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="sm:w-36">
            <option value="all">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </div>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
        {!loading && tasks.length > 0 && (
          <p className="text-xs text-subtlest sm:ml-auto" aria-live="polite">
            {filteredTasks.length} of {tasks.length} tasks
          </p>
        )}
      </div>

      {loadError && (
        <Alert className="mb-3">
          {loadError}{" "}
          <button type="button" onClick={fetchTasksAndProjects} className="font-medium underline">
            Try again
          </button>
        </Alert>
      )}
      {actionError && (
        <Alert className="mb-3" onDismiss={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {body()}

      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultProjectId={selectedProjectId !== "all" ? selectedProjectId : undefined}
        onSuccess={(task) => {
          toast(task?.issueKey ? `Task ${task.issueKey} created` : "Task created");
          fetchTasksAndProjects();
        }}
      />

      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSuccess={(project) => {
          toast(`Project “${project?.name ?? "Untitled"}” created`);
          fetchTasksAndProjects();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteTask}
        title={`Delete ${deleteTarget?.issueKey ?? "task"}?`}
        description={`“${deleteTarget?.title ?? ""}” and its comments are deleted permanently.`}
        confirmLabel="Delete task"
      />
    </>
  );
}
