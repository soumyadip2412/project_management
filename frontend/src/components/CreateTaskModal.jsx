import { useEffect, useState } from "react";
import { BOARD_COLUMNS, STATUS_META, TASK_STATUS, isTaskStatus } from "../lib/taskStatus";
import { api } from "../lib/api";
import { ISSUE_TYPE_META, PICKABLE_ISSUE_TYPES, parseStoryPoints } from "../lib/issueType";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Field, Input, Select, Textarea } from "./ui/Field";
import { Alert, Spinner } from "./ui/Feedback";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export default function CreateTaskModal({ isOpen, onClose, onSuccess, defaultProjectId }) {
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState(TASK_STATUS.TODO);
  const [issueType, setIssueType] = useState("task");
  const [points, setPoints] = useState("");
  const [pointsError, setPointsError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  // Load the project list once per opening (not on every selection change).
  useEffect(() => {
    if (!isOpen) return;
    setTitleError("");
    setServerError("");
    setProjectsLoading(true);
    api
      .get("/projects")
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        setProjects(list);
        setProjectId((current) => defaultProjectId || current || list[0]?._id || "");
      })
      .catch((err) => setServerError(err?.message || "Your projects could not be loaded."))
      .finally(() => setProjectsLoading(false));
  }, [isOpen, defaultProjectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError("Enter a title for the task.");
      return;
    }
    if (!projectId) {
      setServerError("Choose the project this task belongs to.");
      return;
    }
    const storyPoints = parseStoryPoints(points);
    if (storyPoints.error) {
      setPointsError(storyPoints.error);
      return;
    }

    try {
      setLoading(true);
      setServerError("");
      const res = await api.post(`/tasks/${projectId}`, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        issueType,
        storyPoints: storyPoints.value ?? undefined,
      });
      const newTask = res?.data || res;
      setTitle("");
      setDescription("");
      setPoints("");
      setIssueType("task");
      onSuccess?.(newTask);
      onClose();
    } catch (err) {
      setServerError(err?.message || "The task could not be created.");
    } finally {
      setLoading(false);
    }
  };

  const noProjects = !projectsLoading && projects.length === 0;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="New task"
      onSubmit={noProjects ? undefined : handleSubmit}
      footer={
        noProjects ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading} disabled={projectsLoading}>
              Create task
            </Button>
          </>
        )
      }
    >
      {projectsLoading && projects.length === 0 ? (
        <Spinner label="Loading projects" />
      ) : noProjects ? (
        <p className="text-[13px] text-subtle">
          Tasks belong to a project. Create a project first, then add tasks to it.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {serverError && <Alert>{serverError}</Alert>}

          <Field label="Title" required error={titleError}>
            <Input
              placeholder="e.g. Implement OAuth token exchange"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError("");
              }}
              maxLength={200}
              autoComplete="off"
            />
          </Field>

          <Field label="Project" required>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select
                value={status}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isTaskStatus(v)) setStatus(v);
                }}
              >
                {BOARD_COLUMNS.map((key) => (
                  <option key={key} value={key}>
                    {STATUS_META[key].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                {PICKABLE_ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ISSUE_TYPE_META[t].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Story points" hint="Optional, 0–100" error={pointsError}>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={points}
                onChange={(e) => {
                  setPoints(e.target.value);
                  if (pointsError) setPointsError("");
                }}
              />
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              placeholder="Context, acceptance criteria or steps to reproduce"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={10000}
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}
