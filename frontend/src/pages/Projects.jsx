import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Folder, Pencil, Plus, RefreshCw, Search, Trash2, ExternalLink } from "lucide-react";
import { api } from "../lib/api";
import CreateProjectModal from "../components/CreateProjectModal";
import { Menu, PageHeader, SortHeader } from "../components/ui/Navigation";
import { Button, IconButton } from "../components/ui/Button";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { Alert, EmptyState, SkeletonRows } from "../components/ui/Feedback";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { Key, Tag } from "../components/ui/Display";
import { useToast } from "../components/ui/Toast";
import { formatDate, projectStatusLabel } from "../lib/format";
import { useIsWide } from "../lib/useMediaQuery";

// ─── Edit project ─────────────────────────────────────────────────────────────
function EditProjectModal({ project, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name || "");
      setDescription(project.description || "");
      setNameError("");
      setServerError("");
    }
  }, [project]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Enter a project name.");
      return;
    }
    try {
      setLoading(true);
      setServerError("");
      await api.put(`/projects/${project._id}`, { name: name.trim(), description: description.trim() });
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err?.message || "The project could not be saved.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!project}
      onClose={onClose}
      title="Edit project"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="primary" loading={loading}>Save changes</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {serverError && <Alert>{serverError}</Alert>}
        <Field label="Name" required error={nameError}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </Field>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function Projects() {
  const navigate = useNavigate();
  const toast = useToast();
  const isWide = useIsWide();
  const projectCreatedAt = (useLocation().state)?.projectCreatedAt;

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState({ key: "updatedAt", dir: "desc" });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const res = await api.get("/projects");
      setProjects(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setLoadError(err?.message || "Projects could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on mount, and again when a project is created from the top-bar
  // button while this page is already mounted (that navigate() is a no-op).
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects, projectCreatedAt]);

  const handleDelete = async () => {
    // Errors propagate to the dialog, which shows them in place.
    await api.delete(`/projects/${deleteTarget._id}`);
    toast(`Project “${deleteTarget.name}” deleted`);
    fetchProjects();
  };

  const onSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = projects.filter((p) => {
      const matchesSearch =
        !term ||
        p.name?.toLowerCase().includes(term) ||
        p.key?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || (p.status || "active") === statusFilter;
      return matchesSearch && matchesStatus;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) =>
      sort.key === "name"
        ? dir * String(a.name).localeCompare(String(b.name))
        : dir * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    );
  }, [projects, search, statusFilter, sort]);

  const filtersActive = search.trim() !== "" || statusFilter !== "all";

  const actionsFor = (p) => [
    { label: "Open", icon: ExternalLink, onSelect: () => navigate(`/dashboard/projects/${p._id}`) },
    { label: "Edit details", icon: Pencil, onSelect: () => setEditProject(p) },
    { label: "Delete project", icon: Trash2, tone: "danger", onSelect: () => setDeleteTarget(p) },
  ];

  return (
    <>
      <PageHeader
        title="Projects"
        description="Projects you are a member of. Open one to manage its tasks, sprints and members."
        actions={
          <>
            <IconButton label="Refresh" onClick={fetchProjects} disabled={loading} className="border-line bg-surface">
              <RefreshCw size={14} className={loading ? "animate-spin" : undefined} />
            </IconButton>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setIsCreateOpen(true)}>
              New project
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtlest" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Filter projects"
            placeholder="Filter by name, key or description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-40">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </Select>
        {!loading && (
          <p className="text-xs text-subtlest sm:ml-auto" aria-live="polite">
            {visible.length} of {projects.length} {projects.length === 1 ? "project" : "projects"}
          </p>
        )}
      </div>

      {loadError && (
        <Alert className="mb-3">
          {loadError}{" "}
          <button type="button" onClick={fetchProjects} className="font-medium underline">
            Try again
          </button>
        </Alert>
      )}

      <section className="rounded-lg border border-line bg-surface">
        {loading && projects.length === 0 ? (
          <SkeletonRows label="Loading projects" />
        ) : visible.length === 0 ? (
          filtersActive ? (
            <EmptyState
              icon={Search}
              title="No projects match these filters"
              action={
                <Button size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Folder}
              title="No projects yet"
              description="Create a project to start tracking tasks and sprints, or ask a teammate to invite you to theirs."
              action={
                <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setIsCreateOpen(true)}>
                  Create project
                </Button>
              }
            />
          )
        ) : isWide ? (
            <table className="w-full table-fixed text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-xs text-subtlest">
                  <th scope="col" className="w-24 py-2 pl-4 pr-4 font-medium">Key</th>
                  <SortHeader label="Name" column="name" sort={sort} onSort={onSort} className="pr-4" />
                  <th scope="col" className="w-32 py-2 pr-4 font-medium">Status</th>
                  <th scope="col" className="w-20 py-2 pr-4 text-right font-medium">People</th>
                  <SortHeader label="Updated" column="updatedAt" sort={sort} onSort={onSort} className="w-28 pr-4" />
                  <th scope="col" className="w-12 py-2 pr-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((p) => (
                  <tr key={p._id} className="group hover:bg-surface-raised">
                    <td className="py-2.5 pl-4 pr-4"><Key>{p.key}</Key></td>
                    <td className="max-w-0 py-2.5 pr-4">
                      <Link to={`/dashboard/projects/${p._id}`} className="block truncate rounded font-medium text-text group-hover:text-primary">
                        {p.name}
                      </Link>
                      {p.description && <p className="truncate text-xs text-subtlest">{p.description}</p>}
                    </td>
                    <td className="py-2.5 pr-4"><Tag>{projectStatusLabel(p.status)}</Tag></td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-subtle">{p.members?.length ?? 0}</td>
                    <td className="py-2.5 pr-4 text-subtle">{formatDate(p.updatedAt)}</td>
                    <td className="py-2.5 pr-2 text-right">
                      <Menu label={`Actions for ${p.name}`} items={actionsFor(p)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        ) : (
            <ul className="divide-y divide-line">
              {visible.map((p) => (
                <li key={p._id} className="flex items-start gap-2 py-1 pl-4 pr-2">
                  <Link to={`/dashboard/projects/${p._id}`} className="min-w-0 flex-1 py-2">
                    <span className="flex items-center gap-2">
                      <Key>{p.key}</Key>
                      <span className="truncate text-[13px] font-medium text-text">{p.name}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-3 text-xs text-subtlest">
                      <Tag>{projectStatusLabel(p.status)}</Tag>
                      {p.members?.length ?? 0} people
                      <span>Updated {formatDate(p.updatedAt)}</span>
                    </span>
                  </Link>
                  <div className="pt-2">
                    <Menu label={`Actions for ${p.name}`} items={actionsFor(p)} />
                  </div>
                </li>
              ))}
            </ul>
        )}
      </section>

      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(project) => {
          toast(`Project “${project?.name ?? "Untitled"}” created`);
          fetchProjects();
        }}
      />

      <EditProjectModal
        project={editProject}
        onClose={() => setEditProject(null)}
        onSaved={() => {
          toast("Project updated");
          fetchProjects();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.name ?? "project"}?`}
        description="Its tasks, sprints, comments and notes are deleted permanently. Only the project owner can do this."
        confirmLabel="Delete project"
      />
    </>
  );
}
