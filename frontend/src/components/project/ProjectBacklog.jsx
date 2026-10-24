import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { ArrowRightLeft, CheckCircle2, Play, Plus, Route as RouteIcon, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { formatDate, nameOf, taskPath } from "../../lib/format";
import { sprintHealth } from "../../lib/sprintHealth";
import { cn } from "../../lib/utils";
import { useProject } from "../shell/projectContext";
import { ProjectPageHeader } from "../shell/projectRoutes";
import { Button, IconButton } from "../ui/Button";
import { Avatar, IssueTypeIcon, Key, Points, StatusBadge } from "../ui/Display";
import { Alert, EmptyState, SkeletonRows } from "../ui/Feedback";
import { ConfirmDialog } from "../ui/Modal";
import { Menu } from "../ui/Navigation";
import { useToast } from "../ui/Toast";
import CreateSprintModal from "./CreateSprintModal";
import { DayBar } from "./SprintTide";

const BACKLOG = "backlog";
const sprintIdOf = (task) => (typeof task.sprint === "object" ? task.sprint?._id : task.sprint) ?? null;
const pts = (list) => list.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
const byCategory = (list, category) => pts(list.filter((t) => t.statusCategory === category));
const STATUS_LABEL = { planned: "Planned", active: "Active" };

/** A draggable row. Moving also works from its ⋯ menu (keyboard and phones). */
function BacklogRow({ task, projectId, moveItems }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: task._id });
  const assignee = task.assignees?.[0];
  return (
    <li ref={setNodeRef} className={cn("grid grid-cols-[auto_4.5rem_minmax(0,1fr)_auto] items-center gap-3 border-t border-line px-3 py-1.5 sm:grid-cols-[auto_4.5rem_minmax(0,1fr)_auto_auto_auto_auto]", isDragging && "opacity-40")}>
      <span {...listeners} {...attributes} role={undefined} aria-label={`Drag ${task.issueKey}`} className="cursor-grab"><IssueTypeIcon type={task.issueType} /></span>
      <Key>{task.issueKey}</Key>
      <Link to={taskPath({ ...task, project: projectId })} className="truncate rounded text-[13px] text-text hover:text-primary">{task.title}</Link>
      <StatusBadge status={task.status} className="hidden sm:inline-flex" />
      <Points value={task.storyPoints} className="hidden sm:inline-flex" />
      <span className="hidden sm:inline-flex">{assignee ? <span title={nameOf(assignee)}><Avatar name={nameOf(assignee)} size="sm" /></span> : <span className="h-6 w-6" aria-hidden="true" />}</span>
      <Menu label={`Move ${task.issueKey}`} items={moveItems} />
    </li>
  );
}

/** One group: a sprint or the backlog. Also a drop target. */
function Group({ id, label, header, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    // No overflow-hidden here: it would clip the rows' ⋯ menus.
    <section ref={setNodeRef} aria-label={label} className={cn("rounded-md border bg-surface", isOver ? "border-primary" : "border-line")}>
      {header}
      <ul>{children}</ul>
    </section>
  );
}

export default function ProjectBacklog() {
  const { project } = useProject();
  const toast = useToast();
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [avgVelocity, setAvgVelocity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [starting, setStarting] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const fetchData = useCallback(async () => {
    try {
      setError("");
      const [sprintRes, taskRes, velocityRes] = await Promise.all([
        api.get(`/projects/${project._id}/sprints`),
        api.get(`/tasks/${project._id}`, { params: { limit: 100 } }),
        api.get(`/projects/${project._id}/sprints/velocity`).catch(() => null),
      ]);
      setSprints(Array.isArray(sprintRes?.data) ? sprintRes.data : []);
      setTasks(Array.isArray(taskRes?.data?.tasks) ? taskRes.data.tasks : []);
      const v = velocityRes?.data;
      setAvgVelocity(v?.velocityData?.length ? v.avgVelocity : null);
    } catch (err) {
      setError(err?.message || "The backlog could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [project._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    window.addEventListener("pc:issue-created", fetchData);
    return () => window.removeEventListener("pc:issue-created", fetchData);
  }, [fetchData]);

  const moveTask = async (taskId, sprintId) => {
    setActionError("");
    const previous = tasks;
    setTasks((list) => list.map((t) => (t._id === taskId ? { ...t, sprint: sprintId } : t)));
    try {
      await api.put(`/tasks/${project._id}/t/${taskId}`, { sprint: sprintId });
    } catch (err) {
      setTasks(previous);
      setActionError(err?.message || "The issue could not be moved.");
    }
  };

  const startSprint = async (sprint) => {
    setActionError("");
    setStarting(sprint._id);
    try {
      await api.post(`/projects/${project._id}/sprints/${sprint._id}/start`);
      toast(`${sprint.name} started`);
      fetchData();
    } catch (err) {
      setActionError(err?.message || "The sprint could not be started.");
    } finally {
      setStarting(null);
    }
  };

  if (loading) return (<><ProjectPageHeader title="Backlog" /><div className="rounded-md border border-line"><SkeletonRows rows={5} label="Loading backlog" /></div></>);
  if (error) return (<><ProjectPageHeader title="Backlog" /><Alert>{error} <button type="button" onClick={fetchData} className="font-medium underline">Try again</button></Alert></>);

  const open = sprints.filter((s) => s.status === "active" || s.status === "planned").sort((a, b) => (a.status === "active" ? -1 : b.status === "active" ? 1 : (a.order ?? 0) - (b.order ?? 0)));
  const groups = [...open.map((s) => ({ id: s._id, sprint: s })), { id: BACKLOG, sprint: null }];
  const tasksIn = (id) => tasks.filter((t) => (sprintIdOf(t) ?? BACKLOG) === id);
  const moveItemsFor = (task) => groups
    .filter((g) => g.id !== (sprintIdOf(task) ?? BACKLOG))
    .map((g) => ({ label: g.sprint ? `Move to ${g.sprint.name}` : "Move to backlog", icon: ArrowRightLeft, onSelect: () => moveTask(task._id, g.sprint ? g.sprint._id : null) }));

  return (
    <>
      <ProjectPageHeader title="Backlog" actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>Create sprint</Button>} />
      {actionError && <Alert className="mb-3" onDismiss={() => setActionError("")}>{actionError}</Alert>}

      <DndContext
        sensors={sensors}
        onDragEnd={({ active, over }) => {
          if (!over) return;
          const task = tasks.find((t) => t._id === active.id);
          const target = over.id === BACKLOG ? null : over.id;
          if (task && (sprintIdOf(task) ?? null) !== target) moveTask(task._id, target);
        }}
      >
        <div className="space-y-3">
          {groups.map(({ id, sprint }) => {
            const list = tasksIn(id);
            const total = pts(list);
            const health = sprint?.status === "active" ? sprintHealth(sprint, list) : null;
            const over = sprint?.status === "planned" && avgVelocity != null && total > avgVelocity * 1.1;
            const header = (
              <header className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-md bg-surface-raised px-3 py-2.5">
                <h2 className="text-[13px] font-semibold text-text">{sprint ? sprint.name : "Backlog"}</h2>
                {sprint && <span className={cn("inline-flex h-5 items-center rounded-[3px] px-1.5 text-[10.5px] font-bold uppercase tracking-[0.03em]", sprint.status === "active" ? "bg-info-subtle text-info" : "bg-neutral-subtle text-subtle")}>{STATUS_LABEL[sprint.status]}</span>}
                <span className="text-xs text-subtlest">
                  {sprint && `${formatDate(sprint.startDate)} – ${formatDate(sprint.endDate, true)} · `}
                  {list.length} {list.length === 1 ? "issue" : "issues"} · {byCategory(list, "done")} of {total} points
                </span>
                {health && <span className="w-32"><DayBar totalDays={health.totalDays} dayIndex={health.dayIndex} compact /></span>}
                {over && <span className="rounded-[3px] bg-warning-subtle px-1.5 py-0.5 text-xs font-semibold text-warning">{total} pts planned · team averages {avgVelocity}</span>}
                <span className="ml-auto flex items-center gap-1">
                  <span className="hidden items-center gap-1 sm:flex" aria-label="Points by status">
                    <Points value={byCategory(list, "todo")} />
                    <Points value={byCategory(list, "in_progress")} className="bg-info-subtle text-info" />
                    <Points value={byCategory(list, "done")} className="bg-success-subtle text-success" />
                  </span>
                  {sprint?.status === "planned" && <Button size="sm" icon={<Play size={13} />} loading={starting === sprint._id} onClick={() => startSprint(sprint)}>Start sprint</Button>}
                  {sprint?.status === "active" && <Button size="sm" icon={<CheckCircle2 size={13} />} onClick={() => setCompleteTarget(sprint)}>Complete sprint</Button>}
                  {sprint?.status === "planned" && <IconButton label={`Delete ${sprint.name}`} size="sm" tone="danger" onClick={() => setDeleteTarget(sprint)}><Trash2 size={14} /></IconButton>}
                </span>
              </header>
            );
            return (
              <Group key={id} id={id} label={sprint ? sprint.name : "Backlog"} header={header}>
                {list.map((t) => <BacklogRow key={t._id} task={t} projectId={project._id} moveItems={moveItemsFor(t)} />)}
                {list.length === 0 && <li className="border-t border-line px-3 py-3 text-xs text-subtlest">{sprint ? "Drag issues here, or use an issue's ⋯ menu." : "Every issue is in a sprint."}</li>}
              </Group>
            );
          })}
        </div>
      </DndContext>

      {open.length === 0 && (
        <div className="mt-3 rounded-md border border-line bg-surface">
          <EmptyState icon={RouteIcon} title="No sprints planned" description="Create a sprint, move issues into it, then start it." action={<Button size="sm" onClick={() => setCreateOpen(true)}>Create sprint</Button>} />
        </div>
      )}

      <CreateSprintModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (sprint) => {
          await api.post(`/projects/${project._id}/sprints`, sprint);
          toast(`${sprint.name} created`);
          fetchData();
        }}
      />
      <ConfirmDialog
        open={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        onConfirm={async () => {
          await api.post(`/projects/${project._id}/sprints/${completeTarget._id}/complete`, {});
          toast(`${completeTarget.name} completed`);
          fetchData();
        }}
        tone="primary"
        title={`Complete ${completeTarget?.name ?? "sprint"}?`}
        description="Unfinished issues go back to the backlog. The sprint's velocity and burndown are recorded."
        confirmLabel="Complete sprint"
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          await api.delete(`/projects/${project._id}/sprints/${deleteTarget._id}`);
          toast(`${deleteTarget.name} deleted`);
          fetchData();
        }}
        title={`Delete ${deleteTarget?.name ?? "sprint"}?`}
        description="Its issues are kept and moved to the backlog."
        confirmLabel="Delete sprint"
      />
    </>
  );
}
