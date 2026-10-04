import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, Pencil, Plus, SmilePlus, Trash2, X } from "lucide-react";
import { BOARD_COLUMNS, STATUS_META, statusMeta } from "../lib/taskStatus";
import { PRIORITY_VALUES, priorityMeta } from "../lib/priority";
import { ISSUE_TYPE_META, PICKABLE_ISSUE_TYPES, parseStoryPoints } from "../lib/issueType";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button, IconButton } from "../components/ui/Button";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { Alert, EmptyState, Skeleton } from "../components/ui/Feedback";
import { ConfirmDialog } from "../components/ui/Modal";
import { Avatar, IssueTypeIcon, Key } from "../components/ui/Display";
import { useToast } from "../components/ui/Toast";
import { formatDate, memberUserId, nameOf } from "../lib/format";
import { timeAgo } from "../lib/time";

/** Story points: saved when the field loses focus or on Enter. */
function PointsField({ value, onSave }) {
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState("");
  useEffect(() => setDraft(value ?? ""), [value]);

  const commit = () => {
    const parsed = parseStoryPoints(draft);
    if (parsed.error) return setError(parsed.error);
    setError("");
    if (parsed.value !== (value ?? null)) onSave(parsed.value);
  };
  return (
    <span className="block">
      <Input
        aria-label="Story points"
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        step={1}
        placeholder="None"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
        aria-invalid={error ? true : undefined}
        className="w-24"
      />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </span>
  );
}

/** Labels as removable chips; type and press Enter to add one. */
function LabelsField({ labels = [], onSave }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const label = draft.trim().slice(0, 50);
    setDraft("");
    if (!label || labels.includes(label) || labels.length >= 20) return;
    onSave([...labels, label]);
  };
  return (
    <span className="flex flex-wrap items-center gap-1">
      {labels.map((l) => (
        <span key={l} className="inline-flex items-center gap-0.5 rounded bg-neutral-subtle py-0.5 pl-1.5 pr-0.5 text-xs text-subtle">
          {l}
          <button
            type="button"
            aria-label={`Remove label ${l}`}
            onClick={() => onSave(labels.filter((x) => x !== l))}
            className="rounded p-0.5 hover:bg-surface-hover hover:text-text"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        aria-label="Add a label"
        placeholder={labels.length ? "Add" : "Add a label"}
        value={draft}
        maxLength={50}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        onBlur={add}
        className="h-6 w-20 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-xs text-text placeholder:text-subtlest hover:border-line focus:border-primary focus:outline-none"
      />
    </span>
  );
}

const REACTIONS = ["👍", "🎉", "❤️", "👀", "🚀", "✅"];

// comment:moderate comes from "comment:*" in the permission matrix.
const MODERATOR_ROLES = new Set(["project_manager", "scrum_master", "team_lead"]);

/** Comment text with @mentions of real project members highlighted. */
function CommentBody({ text, usernames }) {
  const parts = text.split(/(@[a-z0-9_]+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") && usernames.has(part.slice(1)) ? (
      <span key={i} className="rounded bg-primary-subtle px-0.5 font-medium text-primary">
        {part}
      </span>
    ) : (
      part
    )
  );
}

function Comment({ comment, userId, canModerate, usernames, onSave, onReact, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const isMine = comment.author?._id === userId;

  const save = async (e) => {
    e.preventDefault();
    if (!draft.trim() || draft.trim() === comment.body) return setEditing(false);
    setSaving(true);
    const ok = await onSave(comment._id, draft.trim());
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <li className="flex gap-3">
      <Avatar name={nameOf(comment.author)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-text">{nameOf(comment.author)}</span>
          <time dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString()} className="text-xs text-subtlest">
            {timeAgo(comment.createdAt)}
          </time>
          {comment.isEdited && <span className="text-xs text-subtlest">(edited)</span>}
          <span className="ml-auto flex items-center">
            {isMine && !editing && (
              <IconButton
                label="Edit comment"
                size="sm"
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(true);
                }}
              >
                <Pencil size={13} />
              </IconButton>
            )}
            {(isMine || canModerate) && (
              <IconButton label="Delete comment" size="sm" tone="danger" onClick={() => onDelete(comment._id)}>
                <Trash2 size={13} />
              </IconButton>
            )}
          </span>
        </div>

        {editing ? (
          <form onSubmit={save} className="mt-1 space-y-2">
            <Textarea aria-label="Edit comment" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={5000} autoFocus />
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="primary" loading={saving}>
                Save
              </Button>
              <Button size="sm" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-subtle">
            <CommentBody text={comment.body} usernames={usernames} />
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {(comment.reactions ?? []).map((r) => {
            const mine = r.users?.some((u) => (u?._id ?? u) === userId);
            return (
              <button
                key={r.emoji}
                type="button"
                aria-pressed={mine}
                aria-label={`${r.emoji} ${r.users.length}${mine ? ", including you" : ""}. ${mine ? "Remove" : "Add"} your reaction`}
                onClick={() => onReact(comment._id, r.emoji)}
                className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular-nums ${
                  mine ? "border-primary bg-primary-subtle text-primary" : "border-line text-subtle hover:bg-surface-hover"
                }`}
              >
                <span aria-hidden="true">{r.emoji}</span>
                {r.users.length}
              </button>
            );
          })}
          <IconButton label="Add reaction" size="sm" aria-expanded={picking} onClick={() => setPicking((p) => !p)}>
            <SmilePlus size={14} />
          </IconButton>
          {picking && (
            <span role="group" aria-label="Choose a reaction" className="inline-flex gap-0.5 rounded-full border border-line bg-surface px-1 py-0.5 shadow-card">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`React with ${emoji}`}
                  onClick={() => {
                    onReact(comment._id, emoji);
                    setPicking(false);
                  }}
                  className="rounded-full px-1 text-sm hover:bg-surface-hover"
                >
                  {emoji}
                </button>
              ))}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-center gap-3 py-1.5">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="min-w-0 text-[13px] text-text">{children}</dd>
    </div>
  );
}

export default function TaskDetail() {
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId");
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", dueDate: "" });
  const [titleError, setTitleError] = useState("");
  const [saving, setSaving] = useState(false);

  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [members, setMembers] = useState([]);

  const fetchTaskAndComments = useCallback(async () => {
    if (!taskId || !projectId) {
      setLoading(false);
      return;
    }
    try {
      const [taskRes, commentsRes, membersRes] = await Promise.all([
        api.get(`/tasks/${projectId}/t/${taskId}`),
        api.get(`/projects/${projectId}/tasks/${taskId}/comments`).catch(() => ({ data: { comments: [] } })),
        api.get(`/projects/${projectId}/members`).catch(() => ({ data: { members: [] } })),
      ]);
      setMembers(Array.isArray(membersRes?.data?.members) ? membersRes.data.members : []);
      const t = taskRes?.data;
      setTask(t);
      setEditForm({
        title: t.title || "",
        description: t.description || "",
        dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "",
      });
      const c = commentsRes?.data?.comments ?? [];
      setComments(Array.isArray(c) ? c : []);
      setLoadError("");
    } catch (err) {
      setLoadError(err?.message || "This task could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [taskId, projectId]);

  useEffect(() => {
    fetchTaskAndComments();
  }, [fetchTaskAndComments]);

  const handleUpdateTask = async (updates) => {
    setActionError(null);
    try {
      const res = await api.put(`/tasks/${projectId}/t/${taskId}`, updates);
      setTask(res?.data || res);
      return true;
    } catch (err) {
      setActionError(err?.message || "The task could not be saved.");
      return false;
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.title.trim()) {
      setTitleError("Enter a title.");
      return;
    }
    setSaving(true);
    const ok = await handleUpdateTask({
      title: editForm.title.trim(),
      description: editForm.description,
      dueDate: editForm.dueDate || undefined,
    });
    setSaving(false);
    if (ok) {
      setEditMode(false);
      toast("Task saved");
    }
  };

  const handleDeleteTask = async () => {
    await api.delete(`/tasks/${projectId}/t/${taskId}`);
    toast(`Task ${task?.issueKey ?? ""} deleted`.trim());
    navigate("/dashboard/tasks");
  };

  const handleCreateSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    setActionError(null);
    try {
      await api.post(`/tasks/${projectId}/t/${taskId}/subtasks`, { title: newSubtask.trim() });
      setNewSubtask("");
      fetchTaskAndComments();
    } catch (err) {
      setActionError(err?.message || "The subtask could not be added.");
    }
  };

  const handleUpdateSubtask = async (subtaskId, status) => {
    setActionError(null);
    try {
      await api.put(`/tasks/${projectId}/st/${subtaskId}`, { status });
      fetchTaskAndComments();
    } catch (err) {
      setActionError(err?.message || "The subtask could not be updated.");
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    setActionError(null);
    try {
      await api.delete(`/tasks/${projectId}/st/${subtaskId}`);
      fetchTaskAndComments();
    } catch (err) {
      setActionError(err?.message || "The subtask could not be removed.");
    }
  };

  const handleCreateComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setActionError(null);
    setPosting(true);
    try {
      await api.post(`/projects/${projectId}/tasks/${taskId}/comments`, { body: newComment.trim() });
      setNewComment("");
      fetchTaskAndComments();
    } catch (err) {
      setActionError(err?.message || "The comment could not be posted.");
    } finally {
      setPosting(false);
    }
  };

  const handleEditComment = async (commentId, body) => {
    setActionError(null);
    try {
      const res = await api.put(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, { body });
      setComments((all) => all.map((c) => (c._id === commentId ? { ...c, body, isEdited: true, editedAt: res?.data?.editedAt } : c)));
      return true;
    } catch (err) {
      setActionError(err?.message || "The comment could not be saved.");
      return false;
    }
  };

  const handleReact = async (commentId, emoji) => {
    setActionError(null);
    try {
      const res = await api.post(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}/reactions`, { emoji });
      // The reply carries the comment without its populated author; take only the reactions.
      setComments((all) => all.map((c) => (c._id === commentId ? { ...c, reactions: res?.data?.reactions ?? c.reactions } : c)));
    } catch (err) {
      setActionError(err?.message || "The reaction could not be saved.");
    }
  };

  const handleDeleteComment = async () => {
    await api.delete(`/projects/${projectId}/tasks/${taskId}/comments/${commentToDelete}`);
    fetchTaskAndComments();
  };

  // ── States before the task is available ──
  if (loading) {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <span className="sr-only">Loading task</span>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }
  if (!task) {
    return (
      <EmptyState
        title={!projectId ? "This link is missing its project" : "This task is unavailable"}
        description={
          !projectId
            ? "Open the task from its project or from the Tasks page."
            : loadError || "It may have been deleted, or you are not a member of its project."
        }
        action={
          <Link to="/dashboard/tasks" className="text-[13px] font-medium text-primary hover:underline">
            Go to Tasks
          </Link>
        }
      />
    );
  }

  const myRole = members.find((m) => memberUserId(m) === user?._id)?.role;
  const canModerate = MODERATOR_ROLES.has(myRole) || ["super_admin", "product_manager"].includes(user?.systemRole);
  const usernames = new Set(members.map((m) => m.user?.username).filter(Boolean));
  const subtasks = task.subtasks ?? [];
  const doneSubtasks = subtasks.filter((st) => st.status === "done").length;
  const assignee = task.assignees?.[0];
  const status = statusMeta(task.status);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-[13px] text-subtle">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 rounded hover:text-text">
          <ChevronLeft size={15} aria-hidden="true" /> Back
        </button>
        <span aria-hidden="true" className="text-line-strong">/</span>
        {task.project?._id ? (
          <Link to={`/dashboard/projects/${task.project._id}`} className="truncate rounded hover:text-text">
            {task.project.name}
          </Link>
        ) : (
          <span>Project</span>
        )}
        <span aria-hidden="true" className="text-line-strong">/</span>
        <Key>{task.issueKey}</Key>
      </nav>

      {actionError && (
        <Alert className="mb-4" onDismiss={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:grid-rows-[auto_1fr]">
        {/* Title and description */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {editMode ? (
            <form onSubmit={handleSaveEdit} noValidate className="space-y-4">
              <Field label="Title" required error={titleError}>
                <Input
                  value={editForm.title}
                  onChange={(e) => {
                    setEditForm({ ...editForm, title: e.target.value });
                    setTitleError("");
                  }}
                  maxLength={200}
                  className="text-[15px] font-medium"
                />
              </Field>
              <Field label="Description">
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={8}
                  maxLength={10000}
                />
              </Field>
              <Field label="Due date" className="sm:max-w-48">
                <Input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" loading={saving}>
                  Save changes
                </Button>
                <Button onClick={() => setEditMode(false)} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <section>
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-xl font-semibold tracking-[-0.01em] text-text">{task.title}</h1>
                <Button size="sm" icon={<Pencil size={13} />} onClick={() => setEditMode(true)}>
                  Edit
                </Button>
              </div>
              <div className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-subtle">
                {task.description || <span className="text-subtlest">No description.</span>}
              </div>
            </section>
          )}

        </div>

        {/* ── Details: second on phones, right column on desktop ── */}
        <aside aria-label="Task details" className="space-y-5 border-y border-line py-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-y-0 lg:border-l lg:py-0 lg:pl-6">
          <dl>
            <DetailRow label="Status">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: status.color }} aria-hidden="true" />
                <Select aria-label="Status" value={task.status || "todo"} onChange={(e) => handleUpdateTask({ status: e.target.value })}>
                  {BOARD_COLUMNS.map((key) => (
                    <option key={key} value={key}>
                      {STATUS_META[key].label}
                    </option>
                  ))}
                </Select>
              </span>
            </DetailRow>
            <DetailRow label="Priority">
              <Select aria-label="Priority" value={task.priority || "medium"} onChange={(e) => handleUpdateTask({ priority: e.target.value })}>
                {PRIORITY_VALUES.map((p) => (
                  <option key={p} value={p}>
                    {priorityMeta(p).label}
                  </option>
                ))}
              </Select>
            </DetailRow>
            <DetailRow label="Type">
              <span className="flex items-center gap-1.5">
                <IssueTypeIcon type={task.issueType} />
                <Select aria-label="Type" value={task.issueType || "task"} onChange={(e) => handleUpdateTask({ issueType: e.target.value })}>
                  {[...new Set([...PICKABLE_ISSUE_TYPES, task.issueType || "task"])].map((t) => (
                    <option key={t} value={t}>
                      {ISSUE_TYPE_META[t]?.label ?? t}
                    </option>
                  ))}
                </Select>
              </span>
            </DetailRow>
            <DetailRow label="Assignee">
              <Select
                aria-label="Assignee"
                value={assignee?._id ?? ""}
                onChange={(e) => handleUpdateTask({ assignees: e.target.value ? [e.target.value] : [] })}
              >
                <option value="">Unassigned</option>
                {/* Keep the current assignee selectable even if the member list failed to load. */}
                {assignee && !members.some((m) => memberUserId(m) === assignee._id) && (
                  <option value={assignee._id}>{nameOf(assignee)}</option>
                )}
                {members.map((m) => (
                  <option key={memberUserId(m)} value={memberUserId(m)}>
                    {nameOf(m.user)}
                  </option>
                ))}
              </Select>
            </DetailRow>
            <DetailRow label="Points">
              <PointsField value={task.storyPoints} onSave={(storyPoints) => handleUpdateTask({ storyPoints })} />
            </DetailRow>
            <DetailRow label="Labels">
              <LabelsField labels={task.labels} onSave={(labels) => handleUpdateTask({ labels })} />
            </DetailRow>
            <DetailRow label="Due date">
              {task.dueDate ? formatDate(task.dueDate, true) : <span className="text-subtlest">None</span>}
            </DetailRow>
            {task.sprint && <DetailRow label="Sprint">{task.sprint.name}</DetailRow>}
            <DetailRow label="Created">{formatDate(task.createdAt, true)}</DetailRow>
            <DetailRow label="Updated">{formatDate(task.updatedAt, true)}</DetailRow>
          </dl>

          <div className="border-t border-line pt-4">
            <Button variant="danger-subtle" size="sm" icon={<Trash2 size={13} />} onClick={() => setConfirmDeleteTask(true)}>
              Delete task
            </Button>
          </div>
        </aside>

        {/* Subtasks and comments */}
        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
          {/* Subtasks */}
          <section aria-labelledby="subtasks-heading">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 id="subtasks-heading" className="text-[13px] font-semibold text-text">
                Subtasks
              </h2>
              {subtasks.length > 0 && (
                <span className="text-xs tabular-nums text-subtlest">
                  {doneSubtasks} of {subtasks.length} done
                </span>
              )}
            </div>
            <div className="rounded-lg border border-line">
              {subtasks.length > 0 && (
                <ul className="divide-y divide-line">
                  {subtasks.map((st) => (
                    <li key={st._id} className="group flex items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        id={`st-${st._id}`}
                        checked={st.status === "done"}
                        onChange={(e) => handleUpdateSubtask(st._id, e.target.checked ? "done" : "todo")}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <label
                        htmlFor={`st-${st._id}`}
                        className={`flex-1 cursor-pointer text-[13px] ${st.status === "done" ? "text-subtlest line-through" : "text-text"}`}
                      >
                        {st.title}
                      </label>
                      <IconButton label={`Remove subtask ${st.title}`} size="sm" tone="danger" onClick={() => handleDeleteSubtask(st._id)}>
                        <Trash2 size={13} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={handleCreateSubtask} className={`flex gap-2 p-2 ${subtasks.length > 0 ? "border-t border-line" : ""}`}>
                <Input
                  aria-label="New subtask"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="Add a subtask"
                  maxLength={200}
                  className="border-transparent bg-transparent hover:border-line"
                />
                <Button type="submit" size="sm" icon={<Plus size={13} />} disabled={!newSubtask.trim()}>
                  Add
                </Button>
              </form>
            </div>
          </section>

          {/* Comments */}
          <section aria-labelledby="comments-heading">
            <h2 id="comments-heading" className="mb-3 text-[13px] font-semibold text-text">
              Comments <span className="font-normal text-subtlest">{comments.length}</span>
            </h2>
            {comments.length > 0 && (
              <ol className="mb-4 space-y-4">
                {comments.map((c) => (
                  <Comment
                    key={c._id}
                    comment={c}
                    userId={user?._id}
                    canModerate={canModerate}
                    usernames={usernames}
                    onSave={handleEditComment}
                    onReact={handleReact}
                    onDelete={setCommentToDelete}
                  />
                ))}
              </ol>
            )}
            <form onSubmit={handleCreateComment} className="space-y-2">
              <Field label="Add a comment" hideLabel>
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment. Mention a teammate with @username."
                  rows={3}
                  maxLength={5000}
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm" loading={posting} disabled={!newComment.trim()}>
                  Comment
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteTask}
        onClose={() => setConfirmDeleteTask(false)}
        onConfirm={handleDeleteTask}
        title={`Delete ${task.issueKey}?`}
        description="The task, its subtasks and its comments are deleted permanently."
        confirmLabel="Delete task"
      />
      <ConfirmDialog
        open={!!commentToDelete}
        onClose={() => setCommentToDelete(null)}
        onConfirm={handleDeleteComment}
        title="Delete comment?"
        description="The comment is removed from the task for everyone."
        confirmLabel="Delete comment"
      />
    </div>
  );
}
