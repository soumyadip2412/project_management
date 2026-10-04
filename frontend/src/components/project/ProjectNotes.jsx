import { useCallback, useEffect, useState } from "react";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { memberUserId, nameOf } from "../../lib/format";
import { timeAgo } from "../../lib/time";
import { Button, IconButton } from "../ui/Button";
import { Field, Input, Textarea } from "../ui/Field";
import { Alert, EmptyState, SkeletonRows } from "../ui/Feedback";
import { ConfirmDialog, Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

// Mirrors the permission matrix: "note:*" for these project roles; everyone
// else in the project has note:read only.
const NOTE_WRITERS = new Set(["project_manager", "scrum_master", "team_lead"]);

function NoteEditor({ open, note, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? "");
    setContent(note?.content ?? "");
    setErrors({});
    setError("");
  }, [open, note]);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!title.trim()) next.title = "Give the note a title.";
    if (!content.trim()) next.content = "Write something in the note.";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      setSaving(true);
      setError("");
      await onSave({ title: title.trim(), content: content.trim() });
      onClose();
    } catch (err) {
      setError(err?.message || "The note could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={note ? "Edit note" : "New note"}
      size="lg"
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {note ? "Save note" : "Create note"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Title" required error={errors.title}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Release checklist" />
        </Field>
        <Field label="Note" required error={errors.content}>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} maxLength={20000} />
        </Field>
      </div>
    </Modal>
  );
}

/** Project notes: decisions, checklists and context that don't belong on a single task. */
export default function ProjectNotes({ project }) {
  const toast = useToast();
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState({ open: false, note: null });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const myRole = project.members?.find((m) => memberUserId(m) === user?._id)?.role;
  const canWrite = NOTE_WRITERS.has(myRole) || ["super_admin", "product_manager"].includes(user?.systemRole);

  const fetchNotes = useCallback(async () => {
    try {
      setError("");
      const res = await api.get(`/notes/${project._id}`);
      setNotes(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err?.message || "Notes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [project._id]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const save = async (fields) => {
    if (editor.note) {
      await api.put(`/notes/${project._id}/n/${editor.note._id}`, fields);
      toast("Note saved");
    } else {
      await api.post(`/notes/${project._id}`, fields);
      toast("Note created");
    }
    fetchNotes();
  };

  const remove = async () => {
    await api.delete(`/notes/${project._id}/n/${deleteTarget._id}`);
    toast("Note deleted");
    fetchNotes();
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-text">
          Notes <span className="font-normal text-subtlest">{notes.length}</span>
        </h2>
        {canWrite && (
          <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setEditor({ open: true, note: null })}>
            New note
          </Button>
        )}
      </div>

      {error && <Alert className="mb-3">{error}</Alert>}

      {loading ? (
        <div className="rounded-lg border border-line">
          <SkeletonRows rows={3} label="Loading notes" />
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-line">
          <EmptyState
            icon={FileText}
            title="No notes yet"
            description={
              canWrite
                ? "Keep decisions, checklists and context that don't belong on a single task."
                : "Project managers, scrum masters and team leads can add notes here."
            }
            action={
              canWrite && (
                <Button size="sm" onClick={() => setEditor({ open: true, note: null })}>
                  Create note
                </Button>
              )
            }
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note._id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-semibold text-text">{note.title}</h3>
                  <p className="mt-0.5 text-xs text-subtlest">
                    {nameOf(note.author)}, {timeAgo(note.createdAt)}
                    {note.updatedAt && note.updatedAt !== note.createdAt && ", edited"}
                  </p>
                </div>
                {canWrite && (
                  <span className="flex shrink-0 items-center">
                    <IconButton label={`Edit ${note.title}`} size="sm" onClick={() => setEditor({ open: true, note })}>
                      <Pencil size={13} />
                    </IconButton>
                    <IconButton label={`Delete ${note.title}`} size="sm" tone="danger" onClick={() => setDeleteTarget(note)}>
                      <Trash2 size={13} />
                    </IconButton>
                  </span>
                )}
              </div>
              <p className="mt-2 max-w-[72ch] whitespace-pre-wrap text-[13px] leading-relaxed text-subtle">{note.content}</p>
            </li>
          ))}
        </ul>
      )}

      <NoteEditor open={editor.open} note={editor.note} onClose={() => setEditor({ open: false, note: null })} onSave={save} />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title={`Delete "${deleteTarget?.title ?? ""}"?`}
        description="The note is deleted for everyone in the project."
        confirmLabel="Delete note"
      />
    </div>
  );
}
