import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Search, UserPlus, Users } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/ui/Navigation";
import { Button, IconButton } from "../components/ui/Button";
import { Field, Input, Select } from "../components/ui/Field";
import { Alert, EmptyState, SkeletonRows } from "../components/ui/Feedback";
import { Modal } from "../components/ui/Modal";
import { Avatar, Tag } from "../components/ui/Display";
import { useToast } from "../components/ui/Toast";
import { roleLabel } from "../lib/format";
import { useIsWide } from "../lib/useMediaQuery";

const INVITE_ROLES = ["developer", "scrum_master", "qa", "viewer"];

// ─── Invite ───────────────────────────────────────────────────────────────────
function InviteModal({ open, onClose, projects, onInvited }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [projectId, setProjectId] = useState("");
  const [role, setRole] = useState("developer");
  const [emailError, setEmailError] = useState("");
  const [serverError, setServerError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setEmailError("");
      setServerError("");
      setProjectId((current) => current || projects[0]?._id || "");
    }
  }, [open, projects]);

  const submit = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setEmailError("Enter the email address of an existing account.");
      return;
    }
    try {
      setSending(true);
      setServerError("");
      await api.post(`/projects/${projectId}/members`, { email: value, role });
      toast(`Invitation sent to ${value}`);
      setEmail("");
      onInvited();
      onClose();
    } catch (err) {
      setServerError(err?.message || "The invitation could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite to a project"
      description="The person needs a Project Camp account. They join when they accept the invitation."
      onSubmit={projects.length > 0 ? submit : undefined}
      footer={
        projects.length > 0 ? (
          <>
            <Button onClick={onClose} disabled={sending}>Cancel</Button>
            <Button type="submit" variant="primary" loading={sending}>Send invitation</Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      {projects.length === 0 ? (
        <p className="text-[13px] text-subtle">Invitations are to a project. Create a project first.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {serverError && <Alert>{serverError}</Alert>}
          <Field label="Email address" required error={emailError}>
            <Input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError("");
              }}
              autoComplete="off"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Project">
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Role">
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                {INVITE_ROLES.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function Team() {
  const { user } = useAuth();
  const isWide = useIsWide();
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/projects");
      setProjects(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err?.message || "Your team could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Everyone who shares at least one project with you, with the roles they
  // hold and the projects you share. Derived from the project list; the
  // current user is included even before joining any project.
  const people = useMemo(() => {
    const byId = new Map();
    if (user) {
      byId.set(user._id, { _id: user._id, fullName: user.fullName || user.username, email: user.email, roles: new Set(), projects: [] });
    }
    for (const p of projects) {
      for (const m of p.members ?? []) {
        const u = m.user;
        if (!u || typeof u !== "object" || !u._id) continue;
        const person = byId.get(u._id) ?? { _id: u._id, fullName: u.fullName || u.username, email: u.email, roles: new Set(), projects: [] };
        if (m.role) person.roles.add(m.role);
        person.projects.push(p.name);
        byId.set(u._id, person);
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [projects, user]);

  const visible = people.filter((m) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      m.fullName?.toLowerCase().includes(term) ||
      m.email?.toLowerCase().includes(term) ||
      [...m.roles].some((r) => roleLabel(r).toLowerCase().includes(term))
    );
  });

  const roleTags = (m) =>
    m.roles.size === 0 ? (
      <span className="text-subtlest">—</span>
    ) : (
      <span className="flex flex-wrap gap-1">
        {[...m.roles].map((r) => <Tag key={r}>{roleLabel(r)}</Tag>)}
      </span>
    );

  return (
    <>
      <PageHeader
        title="Team"
        description="People who share at least one project with you, and the roles they hold."
        actions={
          <>
            <IconButton label="Refresh" onClick={fetchProjects} disabled={loading} className="border-line bg-surface">
              <RefreshCw size={14} className={loading ? "animate-spin" : undefined} />
            </IconButton>
            <Button variant="primary" icon={<UserPlus size={15} />} onClick={() => setInviteOpen(true)}>Invite member</Button>
          </>
        }
      />

      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtlest" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Filter people"
            placeholder="Filter by name, email or role"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        {!loading && <p className="ml-auto shrink-0 text-xs text-subtlest">{visible.length} {visible.length === 1 ? "person" : "people"}</p>}
      </div>

      {error && <Alert className="mb-3">{error}</Alert>}

      <section className="rounded-lg border border-line bg-surface">
        {loading ? (
          <SkeletonRows label="Loading team" />
        ) : visible.length === 0 ? (
          <EmptyState icon={Users} title={search ? "Nobody matches that filter" : "No teammates yet"} description={search ? undefined : "Invite someone to one of your projects."} />
        ) : isWide ? (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-subtlest">
                <th scope="col" className="py-2 pl-4 pr-3 font-medium">Name</th>
                <th scope="col" className="py-2 pr-3 font-medium">Email</th>
                <th scope="col" className="py-2 pr-3 font-medium">Project roles</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Shared projects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((m) => (
                <tr key={m._id}>
                  <td className="py-2.5 pl-4 pr-3">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={m.fullName} size="sm" />
                      <span className="font-medium text-text">{m.fullName}</span>
                      {m._id === user?._id && <span className="text-subtlest">(you)</span>}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-subtle">{m.email}</td>
                  <td className="py-2.5 pr-3">{roleTags(m)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-subtle" title={m.projects.join(", ")}>
                    {m.projects.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((m) => (
              <li key={m._id} className="flex items-start gap-3 px-4 py-3">
                <Avatar name={m.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-text">
                    {m.fullName} {m._id === user?._id && <span className="font-normal text-subtlest">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-subtlest">{m.email}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-subtle">
                    {roleTags(m)}
                    <span>{m.projects.length} shared {m.projects.length === 1 ? "project" : "projects"}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} projects={projects} onInvited={fetchProjects} />
    </>
  );
}
