import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Play, Plus, Route, Trash2, CheckCircle2, X } from "lucide-react";
import { api } from "../../lib/api";
import { Button, IconButton } from "../ui/Button";
import { Field, Input } from "../ui/Field";
import { Alert, EmptyState, SkeletonRows } from "../ui/Feedback";
import { ConfirmDialog, Modal } from "../ui/Modal";
import { Avatar, Key, PriorityBadge, StatusBadge, Tag, Points } from "../ui/Display";
import { BurndownChart, VelocityChart } from "./SprintCharts";
import { useToast } from "../ui/Toast";
import { formatDate, nameOf, taskPath } from "../../lib/format";

const EMPTY_SPRINT = { name: "", goal: "", startDate: "", endDate: "" };

const SPRINT_STATUS = { planned: "Planned", active: "Active", completed: "Completed", cancelled: "Cancelled" };

const sprintIdOf = (task) => (typeof task.sprint === "object" ? task.sprint?._id : task.sprint);

// ─── Create sprint ────────────────────────────────────────────────────────────
function CreateSprintModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState(EMPTY_SPRINT);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_SPRINT);
      setErrors({});
      setServerError("");
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Enter a sprint name.";
    if (!form.startDate) next.startDate = "Choose a start date.";
    if (!form.endDate) next.endDate = "Choose an end date.";
    if (form.startDate && form.endDate && form.endDate <= form.startDate) next.endDate = "The end date must be after the start date.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setSaving(true);
      setServerError("");
      await onCreate({ ...form, name: form.name.trim(), goal: form.goal.trim() });
      onClose();
    } catch (err) {
      setServerError(err?.message || "The sprint could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New sprint"
      description="Sprints start in the planned state. Start one when the team begins work on it."
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Create sprint</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {serverError && <Alert>{serverError}</Alert>}
        <Field label="Name" required error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sprint 4" maxLength={100} />
        </Field>
        <Field label="Goal">
          <Input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="What should this sprint achieve?" maxLength={500} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" required error={errors.startDate}>
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="End date" required error={errors.endDate}>
            <Input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function ProjectSprints({ project }) {
  const toast = useToast();
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [starting, setStarting] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [velocity, setVelocity] = useState({ velocityData: [], avgVelocity: 0 });

  const fetchData = useCallback(async () => {
    try {
      setError("");
      const [sprintRes, taskRes, velocityRes] = await Promise.all([
        api.get(`/projects/${project._id}/sprints`),
        api.get(`/tasks/${project._id}`, { params: { limit: 100 } }),
        // Charts are extra: a failure here must not hide the sprints.
        api.get(`/projects/${project._id}/sprints/velocity`).catch(() => null),
      ]);
      if (velocityRes?.data) setVelocity(velocityRes.data);
      setSprints(Array.isArray(sprintRes?.data) ? sprintRes.data : []);
      setTasks(Array.isArray(taskRes?.data?.tasks) ? taskRes.data.tasks : []);
    } catch (err) {
      setError(err?.message || "Sprints could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [project._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSprint = async (sprint) => {
    await api.post(`/projects/${project._id}/sprints`, sprint);
    toast(`${sprint.name} created`);
    fetchData();
  };

  const handleStartSprint = async (sprint) => {
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

  const handleCompleteSprint = async () => {
    await api.post(`/projects/${project._id}/sprints/${completeTarget._id}/complete`, {});
    toast(`${completeTarget.name} completed`);
    fetchData();
  };

  const handleDeleteSprint = async () => {
    await api.delete(`/projects/${project._id}/sprints/${deleteTarget._id}`);
    toast(`${deleteTarget.name} deleted`);
    fetchData();
  };

  const handleAssignTaskToSprint = async (taskId, sprintId) => {
    setActionError("");
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, sprint: sprintId } : t)));
    try {
      await api.put(`/tasks/${project._id}/t/${taskId}`, { sprint: sprintId });
    } catch (err) {
      setTasks(previous);
      setActionError(err?.message || "The task could not be moved.");
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-line">
        <SkeletonRows rows={4} label="Loading sprints" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        {error}{" "}
        <button type="button" onClick={fetchData} className="font-medium underline">Try again</button>
      </Alert>
    );
  }

  const backlogTasks = tasks.filter((t) => !sprintIdOf(t));
  const openSprints = sprints.filter((s) => s.status !== "completed" && s.status !== "cancelled");
  const withProject = (t) => ({ ...t, project: project._id });
  const activeSprint = sprints.find((s) => s.status === "active");
  const completedData = velocity.velocityData ?? [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-text">
          Sprints <span className="font-normal text-subtlest">{sprints.length}</span>
        </h2>
        <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
          New sprint
        </Button>
      </div>

      {actionError && (
        <Alert className="mb-3" onDismiss={() => setActionError("")}>
          {actionError}
        </Alert>
      )}

      {(activeSprint || completedData.length > 0) && (
        <div className="mb-6 grid gap-4 xl:grid-cols-2">
          {activeSprint && <BurndownChart sprint={activeSprint} tasks={tasks.filter((t) => sprintIdOf(t) === activeSprint._id)} />}
          {completedData.length > 0 && <VelocityChart data={completedData} average={velocity.avgVelocity} />}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Sprints */}
        <div className="min-w-0 space-y-3">
          {sprints.length === 0 ? (
            <div className="rounded-lg border border-line">
              <EmptyState
                icon={Route}
                title="No sprints yet"
                description="Group backlog tasks into a time-boxed sprint to plan the next stretch of work."
                action={<Button size="sm" onClick={() => setCreateOpen(true)}>Create sprint</Button>}
              />
            </div>
          ) : (
            sprints.map((sprint) => {
              const sprintTasks = tasks.filter((t) => sprintIdOf(t) === sprint._id);
              const doneCount = sprintTasks.filter((t) => t.statusCategory === "done").length;
              const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
              const donePoints = sprintTasks.filter((t) => t.statusCategory === "done").reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
              const isActive = sprint.status === "active";
              return (
                <section
                  key={sprint._id}
                  aria-label={sprint.name}
                  className={`rounded-lg border bg-surface ${isActive ? "border-primary/50" : "border-line"}`}
                >
                  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[13px] font-semibold text-text">{sprint.name}</h3>
                        <Tag tone={isActive ? "accent" : "neutral"}>{SPRINT_STATUS[sprint.status] ?? "Planned"}</Tag>
                      </div>
                      <p className="mt-0.5 text-xs text-subtlest">
                        {/* Starting a sprint resets its start date to that moment, so a
                            finished sprint is described by when it finished. */}
                        {sprint.status === "completed" && sprint.completedAt
                          ? `Completed ${formatDate(sprint.completedAt, true)}`
                          : `${formatDate(sprint.startDate)} – ${formatDate(sprint.endDate, true)}`}
                        {sprintTasks.length > 0 && (
                          <span>
                            {", "}{doneCount} of {sprintTasks.length} {sprintTasks.length === 1 ? "task" : "tasks"} done
                          </span>
                        )}
                        {totalPoints > 0 && (
                          <span>
                            {", "}{donePoints} of {totalPoints} points
                          </span>
                        )}
                      </p>
                      {sprint.goal && <p className="mt-1 text-[13px] text-subtle">{sprint.goal}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {sprint.status === "planned" && (
                        <Button size="sm" icon={<Play size={13} />} loading={starting === sprint._id} onClick={() => handleStartSprint(sprint)}>
                          Start sprint
                        </Button>
                      )}
                      {isActive && (
                        <Button size="sm" icon={<CheckCircle2 size={13} />} onClick={() => setCompleteTarget(sprint)}>
                          Complete sprint
                        </Button>
                      )}
                      {!isActive && (
                        <IconButton label={`Delete ${sprint.name}`} size="sm" tone="danger" onClick={() => setDeleteTarget(sprint)}>
                          <Trash2 size={14} />
                        </IconButton>
                      )}
                    </div>
                  </header>
                  {sprintTasks.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-subtlest">No tasks in this sprint. Add them from the backlog.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {sprintTasks.map((t) => (
                        <li key={t._id} className="flex items-center gap-3 py-1.5 pl-4 pr-2">
                          <Key className="w-14 shrink-0">{t.issueKey}</Key>
                          <Link to={taskPath(withProject(t))} className="min-w-0 flex-1 truncate rounded text-[13px] text-text hover:text-primary">
                            {t.title}
                          </Link>
                          <Points value={t.storyPoints} />
                          <StatusBadge status={t.status} className="hidden w-28 shrink-0 sm:inline-flex" />
                          {t.assignees?.[0] ? (
                            <span title={nameOf(t.assignees[0])}>
                              <Avatar name={nameOf(t.assignees[0])} size="sm" />
                            </span>
                          ) : (
                            <span className="h-6 w-6 shrink-0" aria-hidden="true" />
                          )}
                          <IconButton
                            label={`Remove ${t.issueKey} from ${sprint.name}`}
                            size="sm"
                            onClick={() => handleAssignTaskToSprint(t._id, null)}
                          >
                            <X size={14} />
                          </IconButton>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </div>

        {/* Backlog */}
        <section aria-labelledby="backlog-heading" className="min-w-0 self-start rounded-lg border border-line bg-surface">
          <h3 id="backlog-heading" className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-text">
            Backlog <span className="font-normal text-subtlest">{backlogTasks.length}</span>
          </h3>
          {backlogTasks.length === 0 ? (
            <p className="px-4 py-3 text-xs text-subtlest">Every task is in a sprint.</p>
          ) : (
            <ul className="max-h-[600px] divide-y divide-line overflow-y-auto">
              {backlogTasks.map((t) => (
                <li key={t._id} className="flex items-center gap-2 py-1.5 pl-4 pr-2">
                  <Link to={taskPath(withProject(t))} className="flex min-w-0 flex-1 items-center gap-2 rounded hover:text-primary">
                    <Key className="shrink-0">{t.issueKey}</Key>
                    <span className="truncate text-[13px] text-text">{t.title}</span>
                  </Link>
                  {(t.priority === "critical" || t.priority === "high") && <PriorityBadge priority={t.priority} className="shrink-0 text-xs" />}
                  {openSprints.length > 0 && (
                      <select
                        aria-label={`Add ${t.issueKey} to a sprint`}
                        value=""
                        onChange={(e) => e.target.value && handleAssignTaskToSprint(t._id, e.target.value)}
                        className="h-7 w-[5.5rem] shrink-0 cursor-pointer rounded border border-transparent bg-transparent text-xs text-primary hover:border-line focus:border-primary focus:outline-none pointer-coarse:h-9"
                      >
                        <option value="" disabled>
                          Add to…
                        </option>
                        {openSprints.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <CreateSprintModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreateSprint} />

      <ConfirmDialog
        open={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        onConfirm={handleCompleteSprint}
        tone="primary"
        title={`Complete ${completeTarget?.name ?? "sprint"}?`}
        description="Unfinished tasks go back to the backlog. The sprint's velocity and burndown are recorded."
        confirmLabel="Complete sprint"
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteSprint}
        title={`Delete ${deleteTarget?.name ?? "sprint"}?`}
        description="Its tasks are kept and moved to the backlog."
        confirmLabel="Delete sprint"
      />
    </div>
  );
}
