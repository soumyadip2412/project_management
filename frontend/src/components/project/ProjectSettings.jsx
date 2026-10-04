import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/Field";
import { Alert } from "../ui/Feedback";
import { ConfirmDialog } from "../ui/Modal";
import { useToast } from "../ui/Toast";

export default function ProjectSettings({ project, onProjectUpdate }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(project.name || "");
  const [description, setDescription] = useState(project.description || "");
  const [methodology, setMethodology] = useState(project.methodology || "kanban");
  const [nameError, setNameError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setName(project.name || "");
    setDescription(project.description || "");
  }, [project.name, project.description]);

  const dirty =
    name !== (project.name || "") ||
    description !== (project.description || "") ||
    methodology !== (project.methodology || "kanban");

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Enter a project name.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await api.put(`/projects/${project._id}`, { name: name.trim(), description: description.trim(), methodology });
      toast("Project settings saved");
      onProjectUpdate();
    } catch (err) {
      setError(err?.message || "The settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await api.delete(`/projects/${project._id}`);
    toast(`Project “${project.name}” deleted`);
    navigate("/dashboard/projects");
  };

  return (
    <div className="max-w-2xl space-y-10">
      <section aria-labelledby="general-heading">
        <h2 id="general-heading" className="text-[13px] font-semibold text-text">General</h2>
        <form onSubmit={handleSave} noValidate className="mt-3 space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Name" required error={nameError}>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError("");
              }}
              maxLength={100}
            />
          </Field>
          <Field label="How the team works">
            <Select value={methodology} onChange={(e) => setMethodology(e.target.value)}>
                <option value="scrum">Scrum: work in sprints</option>
                <option value="kanban">Kanban: continuous flow</option>
                <option value="waterfall">Waterfall: planned phases</option>
            </Select>
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} />
          </Field>
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </form>
      </section>

      <section aria-labelledby="danger-heading" className="rounded-lg border border-danger/40">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="danger-heading" className="text-[13px] font-semibold text-text">Delete this project</h2>
            <p className="mt-0.5 text-xs text-subtle">
              Removes the project with all of its tasks, sprints, comments and notes. Only the owner can do this, and it cannot be undone.
            </p>
          </div>
          <Button variant="danger-subtle" onClick={() => setConfirmDelete(true)}>
            Delete project
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={`Delete ${project.name}?`}
        description="Its tasks, sprints, comments and notes are deleted permanently."
        confirmLabel="Delete project"
      />
    </div>
  );
}
