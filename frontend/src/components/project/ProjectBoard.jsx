import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Route as RouteIcon, Search } from "lucide-react";
import { api } from "../../lib/api";
import { nameOf, memberUserId } from "../../lib/format";
import { PICKABLE_ISSUE_TYPES, issueTypeMeta } from "../../lib/issueType";
import { PRIORITY_VALUES, priorityMeta } from "../../lib/priority";
import { statusCategoryOf } from "../../lib/taskStatus";
import { useActiveSprint } from "../../lib/useActiveSprint";
import { cn } from "../../lib/utils";
import { useProject } from "../shell/projectContext";
import { ProjectPageHeader } from "../shell/projectRoutes";
import TaskBoard from "../tasks/TaskBoard";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Display";
import { Alert, EmptyState, SkeletonRows } from "../ui/Feedback";
import { Input, Select } from "../ui/Field";
import { ConfirmDialog } from "../ui/Modal";
import { Segmented } from "../ui/Navigation";
import { useToast } from "../ui/Toast";
import SprintTide from "./SprintTide";

const CORE_COLUMNS = ["todo", "in_progress", "in_review", "qa_testing", "done"];

// The grouping choice is a per-viewer convenience: remembered per project,
// and harmless to lose (private windows, cleared storage).
function useStoredGroupBy(projectId) {
  const key = `pc:board-group:${projectId}`;
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) === "assignee" ? "assignee" : "none";
    } catch {
      return "none";
    }
  });
  const update = (next) => {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // Not stored: the choice lasts for this visit only.
    }
  };
  return [value, update];
}

export default function ProjectBoard() {
  const { project } = useProject();
  const toast = useToast();
  const isScrum = project.methodology === "scrum";
  const active = useActiveSprint(project._id, { enabled: isScrum });
  const [kanban, setKanban] = useState({ tasks: [], total: 0, loading: !isScrum, error: "" });
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [priority, setPriority] = useState("all");
  const [people, setPeople] = useState([]);
  const [groupBy, setGroupBy] = useStoredGroupBy(project._id);
  const [completeOpen, setCompleteOpen] = useState(false);

  const loadKanban = useCallback(async () => {
    try {
      const res = await api.get(`/tasks/${project._id}`, { params: { limit: 100 } });
      setKanban({ tasks: res?.data?.tasks ?? [], total: res?.data?.totalTasks ?? 0, loading: false, error: "" });
    } catch (err) {
      setKanban((k) => ({ ...k, loading: false, error: err?.message || "The board could not be loaded." }));
    }
  }, [project._id]);

  useEffect(() => {
    if (!isScrum) loadKanban();
  }, [isScrum, loadKanban]);

  const reload = isScrum ? active.refresh : loadKanban;
  useEffect(() => {
    window.addEventListener("pc:issue-created", reload);
    return () => window.removeEventListener("pc:issue-created", reload);
  }, [reload]);

  const source = isScrum ? active.issues : kanban.tasks.filter((t) => t.status !== "backlog");
  const setTasks = isScrum ? active.setIssues : (fn) => setKanban((k) => ({ ...k, tasks: fn(k.tasks) }));
  const loading = isScrum ? active.loading : kanban.loading;
  const error = isScrum ? active.error : kanban.error;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source.filter(
      (t) =>
        (!q || t.title.toLowerCase().includes(q) || t.issueKey?.toLowerCase().includes(q)) &&
        (type === "all" || t.issueType === type) &&
        (priority === "all" || t.priority === priority) &&
        (people.length === 0 || t.assignees?.some((a) => people.includes(a?._id ?? a)))
    );
  }, [source, query, type, priority, people]);

  // Backlog and Cancelled appear only when an issue on the board holds them,
  // so a sprint board reads To do → Done like Jira, yet nothing is ever hidden.
  const columns = useMemo(() => {
    const has = (s) => visible.some((t) => t.status === s);
    return [...(has("backlog") ? ["backlog"] : []), ...CORE_COLUMNS, ...(has("cancelled") ? ["cancelled"] : [])];
  }, [visible]);

  const handleMove = async (task, status) => {
    const before = { status: task.status, statusCategory: task.statusCategory };
    setTasks((list) => list.map((t) => (t._id === task._id ? { ...t, status, statusCategory: statusCategoryOf(status) } : t)));
    try {
      const res = await api.put(`/tasks/${project._id}/t/${task._id}`, { status });
      if (res?.data) setTasks((list) => list.map((t) => (t._id === task._id ? { ...t, ...res.data } : t)));
    } catch (err) {
      setTasks((list) => list.map((t) => (t._id === task._id ? { ...t, ...before } : t)));
      toast(err?.message || "The issue could not be moved.", "error");
    }
  };

  const completeSprint = async () => {
    await api.post(`/projects/${project._id}/sprints/${active.sprint._id}/complete`, {});
    toast(`${active.sprint.name} completed`);
    active.refresh();
  };

  const members = (project.members ?? []).filter((m) => m.user && typeof m.user === "object");
  const togglePerson = (id) => setPeople((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <>
      <ProjectPageHeader title="Board" />

      {isScrum && active.sprint && (
        <SprintTide
          sprint={active.sprint}
          issues={active.issues}
          action={<Button size="sm" icon={<CheckCircle2 size={13} />} onClick={() => setCompleteOpen(true)}>Complete sprint</Button>}
        />
      )}

      {error && (
        <Alert className="mb-3">
          {error}{" "}
          <button type="button" onClick={reload} className="font-medium underline">Try again</button>
        </Alert>
      )}

      {!isScrum && kanban.total > kanban.tasks.length && (
        <Alert tone="info" className="mb-3">
          Showing the {kanban.tasks.length} most recent issues of {kanban.total}. Use All issues to find the rest.
        </Alert>
      )}

      {loading ? (
        <div className="rounded-md border border-line"><SkeletonRows rows={4} label="Loading board" /></div>
      ) : isScrum && !active.sprint ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState
            icon={RouteIcon}
            title="No active sprint"
            description="Plan a sprint in the backlog and start it to see its board here."
            action={<Link to={`/dashboard/projects/${project._id}/backlog`} className="text-[13px] font-medium text-primary hover:underline">Go to the backlog</Link>}
          />
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-52">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtlest" />
              <Input aria-label="Search board" placeholder="Search board" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
            </div>
            <span className="flex items-center" role="group" aria-label="Assignees">
              {members.map((m) => {
                const id = memberUserId(m);
                const on = people.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    aria-label={`Filter by ${nameOf(m.user)}`}
                    title={nameOf(m.user)}
                    onClick={() => togglePerson(id)}
                    className={cn("-ml-1 rounded-full first:ml-0", on ? "ring-2 ring-primary" : "ring-2 ring-bg")}
                  >
                    <Avatar name={nameOf(m.user)} size="sm" />
                  </button>
                );
              })}
            </span>
            <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className="w-auto">
              <option value="all">All types</option>
              {PICKABLE_ISSUE_TYPES.map((t) => <option key={t} value={t}>{issueTypeMeta(t).label}</option>)}
            </Select>
            <Select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-auto">
              <option value="all">All priorities</option>
              {PRIORITY_VALUES.map((p) => <option key={p} value={p}>{priorityMeta(p).label}</option>)}
            </Select>
            <span className="ml-auto">
              <Segmented label="Group" value={groupBy} onChange={setGroupBy} items={[{ id: "none", label: "None" }, { id: "assignee", label: "By assignee" }]} />
            </span>
          </div>

          <TaskBoard
            tasks={visible.map((t) => ({ ...t, project: t.project ?? project._id }))}
            onMove={handleMove}
            columns={columns}
            groupBy={groupBy}
            wipLimits={project.settings?.wipLimits ?? {}}
            showProject={false}
          />
        </>
      )}

      {active.sprint && (
        <ConfirmDialog
          open={completeOpen}
          onClose={() => setCompleteOpen(false)}
          onConfirm={completeSprint}
          tone="primary"
          title={`Complete ${active.sprint.name}?`}
          description="Unfinished issues go back to the backlog. The sprint's velocity and burndown are recorded."
          confirmLabel="Complete sprint"
        />
      )}
    </>
  );
}
