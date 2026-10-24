import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Field";
import { Alert } from "../ui/Feedback";
import { Modal } from "../ui/Modal";

const EMPTY_SPRINT = { name: "", goal: "", startDate: "", endDate: "" };

// ─── Create sprint ────────────────────────────────────────────────────────────
export default function CreateSprintModal({ open, onClose, onCreate }) {
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
