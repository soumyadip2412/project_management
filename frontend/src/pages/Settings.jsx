import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { UserMinus, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import ThemeToggle from "../components/ThemeToggle";
import { PageHeader, TabPanel, Tabs } from "../components/ui/Navigation";
import { Button, IconButton } from "../components/ui/Button";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { Alert, EmptyState, SkeletonRows } from "../components/ui/Feedback";
import { ConfirmDialog } from "../components/ui/Modal";
import { Avatar, Tag } from "../components/ui/Display";
import { useToast } from "../components/ui/Toast";
import { memberUserId, nameOf, roleLabel } from "../lib/format";
import { passwordProblem } from "../lib/password";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Password" },
  { id: "notifications", label: "Notifications" },
  { id: "appearance", label: "Appearance" },
  { id: "workspace", label: "Workspace" },
];

/** A settings group: title and explanation on the left, controls on the right. */
function Section({ title, description, children }) {
  return (
    <section className="grid gap-4 border-b border-line py-6 first:pt-0 last:border-0 md:grid-cols-[220px_1fr] md:gap-8">
      <div>
        <h2 className="text-[13px] font-semibold text-text">{title}</h2>
        {description && <p className="mt-1 text-xs leading-relaxed text-subtle">{description}</p>}
      </div>
      <div className="min-w-0 max-w-xl">{children}</div>
    </section>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

/** Shown under the email field until the address is verified. */
function EmailVerificationNotice() {
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const resend = async () => {
    try {
      setSending(true);
      setError("");
      await api.post("/auth/resend-email-verification");
      toast("Verification email sent");
    } catch (err) {
      setError(err?.message || "The verification email could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Alert tone="info">
      <p>Your email address is not verified yet. Open the link we emailed you, or request a new one.</p>
      {error && <p className="mt-1 text-danger">{error}</p>}
      <Button size="sm" loading={sending} onClick={resend} className="mt-2">
        Resend verification email
      </Button>
    </Alert>
  );
}

function ProfileSettings() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [nameError, setNameError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setFullName(user?.fullName || ""), [user?.fullName]);

  const save = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setNameError("Enter your name.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await api.put("/auth/update-profile", { fullName: fullName.trim() });
      updateUser({ fullName: fullName.trim() });
      toast("Profile saved");
    } catch (err) {
      setError(err?.message || "Your profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Profile" description="How you appear to teammates on tasks, comments and member lists.">
      <form onSubmit={save} noValidate className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Full name" required error={nameError}>
          <Input value={fullName} onChange={(e) => { setFullName(e.target.value); setNameError(""); }} maxLength={100} autoComplete="name" />
        </Field>
        <Field label="Email" hint="Your sign-in address. It cannot be changed here.">
          <Input value={user?.email || ""} disabled readOnly />
        </Field>
        {user && !user.isEmailVerified && <EmailVerificationNotice />}
        <Field label="Username" hint="Used for @mentions in comments. It cannot be changed.">
          <Input value={user?.username || ""} disabled readOnly className="font-mono" />
        </Field>
        <Button type="submit" variant="primary" loading={saving} disabled={fullName === (user?.fullName || "")}>
          Save profile
        </Button>
      </form>
    </Section>
  );
}

// ─── Password ─────────────────────────────────────────────────────────────────
function SecuritySettings() {
  const toast = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    const next = {};
    if (!oldPassword) next.old = "Enter your current password.";
    const problem = passwordProblem(newPassword);
    if (problem) next.next = problem;
    if (confirmPassword !== newPassword) next.confirm = "The passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setSaving(true);
      setServerError("");
      await api.post("/auth/change-password", { oldPassword, newPassword });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Password changed. Other devices have been signed out.");
    } catch (err) {
      setServerError(err?.message || "Your password could not be changed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Change password" description="Changing your password signs you out on every other device.">
      <form onSubmit={save} noValidate className="space-y-4">
        {serverError && <Alert>{serverError}</Alert>}
        <Field label="Current password" required error={errors.old}>
          <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="New password" required hint="At least 8 characters, with a letter and a number." error={errors.next}>
          <Input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" required error={errors.confirm}>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Button type="submit" variant="primary" loading={saving}>
          Change password
        </Button>
      </form>
    </Section>
  );
}

// ─── Notifications (what the app actually does) ──────────────────────────────
function NotificationSettings() {
  const events = [
    "You are assigned to a task",
    "A task you are assigned to, reported or watch changes status",
    "Someone comments on such a task, or mentions you with @username",
    "A sprint in one of your projects starts or completes",
    "You are invited to a project, or a project you belong to is deleted",
  ];
  return (
    <Section
      title="In-app notifications"
      description="Shown under the bell in the top bar. Email and push delivery are not available, so there is nothing to configure yet."
    >
      <ul className="space-y-2 text-[13px] text-subtle">
        {events.map((e) => (
          <li key={e} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-subtlest" />
            {e}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ─── Appearance ───────────────────────────────────────────────────────────────
function AppearanceSettings() {
  return (
    <Section title="Theme" description="System follows your operating system and switches automatically. Saved on this device.">
      <ThemeToggle />
    </Section>
  );
}

// ─── Workspace ────────────────────────────────────────────────────────────────
function WorkspaceSettings({ initialWorkspaceId }) {
  const toast = useToast();
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeId, setActiveId] = useState(initialWorkspaceId ?? null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);

  // List of workspaces, once.
  useEffect(() => {
    api
      .get("/workspaces")
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        setWorkspaces(list);
        setActiveId((current) => (current && list.some((w) => w._id === current) ? current : list[0]?._id ?? null));
        if (list.length === 0) setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || "Workspaces could not be loaded.");
        setLoading(false);
      });
  }, []);

  // Full detail (members with names) for the selected workspace.
  const fetchWorkspace = useCallback(async () => {
    if (!activeId) return;
    try {
      setError("");
      const res = await api.get(`/workspaces/${activeId}`);
      setWorkspace(res?.data);
      setName(res?.data?.name || "");
      setDescription(res?.data?.description || "");
    } catch (err) {
      setError(err?.message || "This workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const myRole = workspace?.members?.find((m) => memberUserId(m) === user?._id)?.role;
  const canManage = myRole === "owner" || myRole === "admin" || user?.systemRole === "super_admin";

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setSaveError("Enter a workspace name.");
      return;
    }
    try {
      setSaving(true);
      setSaveError("");
      await api.put(`/workspaces/${activeId}`, { name: name.trim(), description: description.trim() });
      toast("Workspace saved");
      fetchWorkspace();
    } catch (err) {
      setSaveError(err?.message || "The workspace could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const invite = async (e) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setInviteError("Enter the email address of an existing account.");
      return;
    }
    try {
      setInviting(true);
      setInviteError("");
      await api.post(`/workspaces/${activeId}/invite`, { email, role: inviteRole });
      setInviteEmail("");
      toast(`${email} added to the workspace`);
      fetchWorkspace();
    } catch (err) {
      setInviteError(err?.message || "That person could not be added.");
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (member, role) => {
    try {
      setError("");
      await api.put(`/workspaces/${activeId}/members/${memberUserId(member)}`, { role });
      toast(`${nameOf(member.user)} is now ${roleLabel(role).toLowerCase()}`);
    } catch (err) {
      setError(err?.message || "The role could not be changed.");
    } finally {
      fetchWorkspace();
    }
  };

  const remove = async () => {
    await api.delete(`/workspaces/${activeId}/members/${memberUserId(removeTarget)}`);
    toast(`${nameOf(removeTarget.user)} removed from the workspace`);
    fetchWorkspace();
  };

  if (loading) return <SkeletonRows rows={4} label="Loading workspace" />;
  if (error && !workspace) return <Alert>{error}</Alert>;
  if (workspaces.length === 0) {
    return <EmptyState title="You are not in a workspace yet" description="Create one from the Workspaces page, or create a project and one is set up for you." />;
  }

  return (
    <div>
      {workspaces.length > 1 && (
        <div className="mb-6 max-w-xs">
          <Field label="Workspace">
            <Select value={activeId ?? ""} onChange={(e) => setActiveId(e.target.value)}>
              {workspaces.map((w) => (
                <option key={w._id} value={w._id}>{w.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {!canManage && (
        <Alert tone="info" className="mb-6">
          You are a {roleLabel(myRole).toLowerCase()} here. Only owners and admins can change the workspace or its members.
        </Alert>
      )}

      <Section title="Details" description="The name shown in workspace lists.">
        <form onSubmit={save} noValidate className="space-y-4">
          {saveError && <Alert>{saveError}</Alert>}
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} maxLength={80} />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canManage} rows={2} maxLength={500} />
          </Field>
          {canManage && (
            <Button type="submit" variant="primary" loading={saving}>
              Save workspace
            </Button>
          )}
        </form>
      </Section>

      <Section title="Members" description="Adding someone gives them access to the workspace. Removing them also removes them from its projects.">
        <ul className="divide-y divide-line rounded-lg border border-line">
          {(workspace?.members ?? []).map((m) => {
            const person = typeof m.user === "object" ? m.user : null;
            return (
              <li key={memberUserId(m)} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={nameOf(person)} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-text">
                    {nameOf(person)} {memberUserId(m) === user?._id && <span className="text-subtlest">(you)</span>}
                  </p>
                  {person?.email && <p className="truncate text-xs text-subtlest">{person.email}</p>}
                </div>
                {canManage && m.role !== "owner" ? (
                  <Select
                    aria-label={`Role of ${nameOf(person)}`}
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value)}
                    className="w-28 shrink-0"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="guest">Guest</option>
                  </Select>
                ) : (
                  <Tag tone={m.role === "owner" ? "accent" : "neutral"}>{roleLabel(m.role)}</Tag>
                )}
                {canManage && m.role !== "owner" ? (
                  <IconButton label={`Remove ${nameOf(person)}`} size="sm" tone="danger" onClick={() => setRemoveTarget(m)}>
                    <UserMinus size={14} />
                  </IconButton>
                ) : (
                  <span className="w-7" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ul>

        {canManage && (
          <form onSubmit={invite} noValidate className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
            <Field label="Email to add" hideLabel error={inviteError} className="flex-1">
              <Input type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={(e) => { setInviteEmail(e.target.value); setInviteError(""); }} />
            </Field>
            <Field label="Role" hideLabel className="sm:w-32">
              <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="guest">Guest</option>
              </Select>
            </Field>
            <Button type="submit" icon={<UserPlus size={14} />} loading={inviting}>
              Add member
            </Button>
          </form>
        )}
      </Section>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={remove}
        title={`Remove ${nameOf(removeTarget?.user)}?`}
        description="They lose access to this workspace and to every project in it, except projects they own."
        confirmLabel="Remove member"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const activeTab = TABS.some((t) => t.id === requested) ? requested : "profile";

  return (
    <>
      <PageHeader title="Settings" description="Your account, and the workspaces you belong to." />
      <Tabs
        label="Settings sections"
        items={TABS}
        value={activeTab}
        onChange={(tab) => setSearchParams(tab === "profile" ? {} : { tab }, { replace: true })}
        className="mb-6"
      />
      <TabPanel id={activeTab}>
        {activeTab === "profile" && <ProfileSettings />}
        {activeTab === "security" && <SecuritySettings />}
        {activeTab === "notifications" && <NotificationSettings />}
        {activeTab === "appearance" && <AppearanceSettings />}
        {activeTab === "workspace" && <WorkspaceSettings initialWorkspaceId={searchParams.get("workspace")} />}
      </TabPanel>
    </>
  );
}
