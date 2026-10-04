import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Layers, Plus, RefreshCw, Search } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/ui/Navigation";
import { Button, IconButton } from "../components/ui/Button";
import { Field, Input, Textarea } from "../components/ui/Field";
import { Alert, EmptyState, SkeletonRows } from "../components/ui/Feedback";
import { Modal } from "../components/ui/Modal";
import { Key, Tag } from "../components/ui/Display";
import { useToast } from "../components/ui/Toast";
import { memberUserId, nameOf, roleLabel } from "../lib/format";
import { useIsWide } from "../lib/useMediaQuery";

function CreateWorkspaceModal({ open, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNameError("");
      setServerError("");
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Enter a workspace name.");
      return;
    }
    try {
      setSaving(true);
      setServerError("");
      const res = await api.post("/workspaces", { name: name.trim(), description: description.trim() });
      setName("");
      setDescription("");
      onCreated(res?.data);
      onClose();
    } catch (err) {
      setServerError(err?.message || "The workspace could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New workspace"
      description="A workspace groups projects and the people who work on them. You will be its owner."
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Create workspace</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {serverError && <Alert>{serverError}</Alert>}
        <Field label="Name" required error={nameError}>
          <Input value={name} onChange={(e) => { setName(e.target.value); setNameError(""); }} placeholder="e.g. Platform team" maxLength={80} />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} />
        </Field>
      </div>
    </Modal>
  );
}

export default function Workspaces() {
  const { user } = useAuth();
  const toast = useToast();
  const isWide = useIsWide();
  const [workspaces, setWorkspaces] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/workspaces");
      setWorkspaces(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err?.message || "Workspaces could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const term = search.trim().toLowerCase();
  const visible = workspaces.filter((w) => !term || w.name?.toLowerCase().includes(term) || w.slug?.toLowerCase().includes(term));
  const myRole = (ws) => ws.members?.find((m) => memberUserId(m) === user?._id)?.role;

  return (
    <>
      <PageHeader
        title="Workspaces"
        description="Workspaces you belong to. Members, roles and names are managed in Settings."
        actions={
          <>
            <IconButton label="Refresh" onClick={fetchWorkspaces} disabled={loading} className="border-line bg-surface">
              <RefreshCw size={14} className={loading ? "animate-spin" : undefined} />
            </IconButton>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>New workspace</Button>
          </>
        }
      />

      {workspaces.length > 3 && (
        <div className="relative mb-3 sm:w-72">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtlest" aria-hidden="true" />
          <Input type="search" aria-label="Filter workspaces" placeholder="Filter by name" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
      )}

      {error && <Alert className="mb-3">{error}</Alert>}

      <section className="rounded-lg border border-line bg-surface">
        {loading ? (
          <SkeletonRows rows={3} label="Loading workspaces" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={search ? "No workspaces match that filter" : "No workspaces yet"}
            description={search ? undefined : "Create a workspace, or create a project and one is set up for you."}
            action={!search && <Button size="sm" onClick={() => setCreateOpen(true)}>Create workspace</Button>}
          />
        ) : isWide ? (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-subtlest">
                <th scope="col" className="py-2 pl-4 pr-3 font-medium">Name</th>
                <th scope="col" className="py-2 pr-3 font-medium">Owner</th>
                <th scope="col" className="py-2 pr-3 font-medium">Your role</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Members</th>
                <th scope="col" className="w-24 py-2 pr-4"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((ws) => (
                <tr key={ws._id}>
                  <td className="py-2.5 pl-4 pr-3">
                    <p className="font-medium text-text">{ws.name}</p>
                    <Key>{ws.slug}</Key>
                  </td>
                  <td className="py-2.5 pr-3 text-subtle">{nameOf(ws.owner)}</td>
                  <td className="py-2.5 pr-3"><Tag>{roleLabel(myRole(ws))}</Tag></td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-subtle">{ws.members?.length ?? 0}</td>
                  <td className="py-2.5 pr-4 text-right">
                    <Link to={`/dashboard/settings?tab=workspace&workspace=${ws._id}`} className="rounded text-xs font-medium text-primary hover:underline">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((ws) => (
              <li key={ws._id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-text">{ws.name}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-subtlest">
                    <Tag>{roleLabel(myRole(ws))}</Tag> {ws.members?.length ?? 0} members
                  </p>
                </div>
                <Link to={`/dashboard/settings?tab=workspace&workspace=${ws._id}`} className="rounded text-xs font-medium text-primary hover:underline">
                  Manage
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateWorkspaceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(ws) => {
          toast(`Workspace “${ws?.name ?? ""}” created`);
          fetchWorkspaces();
        }}
      />
    </>
  );
}
