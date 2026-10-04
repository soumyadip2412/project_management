import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Field, Input, Select, Textarea } from "./ui/Field";
import { Alert } from "./ui/Feedback";

// Mirrors the API's rule for project keys (2–10 letters/digits, starting with a letter).
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]{1,9}$/;
const deriveKey = (name) => name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();

export default function CreateProjectModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [methodology, setMethodology] = useState("scrum");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setServerError("");
    }
  }, [isOpen]);

  const handleNameChange = (value) => {
    setName(value);
    // The key follows the name until the person edits it themselves.
    if (!keyEdited) setKey(deriveKey(value));
  };

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = "Enter a project name.";
    if (key.trim() && !KEY_PATTERN.test(key.trim())) {
      next.key = "Use 2–10 letters or digits, starting with a letter.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);
      setServerError("");
      const res = await api.post("/projects", {
        name: name.trim(),
        key: key.trim().toUpperCase() || undefined,
        description: description.trim() || undefined,
        methodology,
      });
      const newProject = res?.data || res;
      setName("");
      setKey("");
      setKeyEdited(false);
      setDescription("");
      setMethodology("scrum");
      onSuccess?.(newProject);
      onClose();
    } catch (err) {
      setServerError(err?.message || "The project could not be created.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="New project"
      description="Projects hold tasks, sprints and members. You become its project manager."
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Create project
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {serverError && <Alert>{serverError}</Alert>}

        <Field label="Name" required error={errors.name}>
          <Input
            placeholder="e.g. NextGen Web Engine"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            maxLength={100}
            autoComplete="off"
          />
        </Field>

        <Field
          label="Key"
          hint="Prefix for issue keys, like NEXT-12. Leave it blank to derive one from the name."
          error={errors.key}
        >
          <Input
            placeholder="e.g. NEXT"
            value={key}
            onChange={(e) => {
              setKeyEdited(true);
              setKey(e.target.value.toUpperCase());
            }}
            maxLength={10}
            autoComplete="off"
            className="font-mono uppercase placeholder:normal-case placeholder:font-sans sm:max-w-40"
          />
        </Field>

        <Field label="How the team works" hint="Scrum projects plan work in sprints; you can change this later.">
          <Select value={methodology} onChange={(e) => setMethodology(e.target.value)}>
            <option value="scrum">Scrum: work in sprints</option>
            <option value="kanban">Kanban: continuous flow</option>
            <option value="waterfall">Waterfall: planned phases</option>
          </Select>
        </Field>

        <Field label="Description">
          <Textarea
            placeholder="What is the goal of this project?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </Field>
      </div>
    </Modal>
  );
}
