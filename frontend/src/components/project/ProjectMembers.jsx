import { useState, useEffect, useCallback } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Button, IconButton } from "../ui/Button";
import { Field, Input, Select } from "../ui/Field";
import { Alert, SkeletonRows } from "../ui/Feedback";
import { ConfirmDialog } from "../ui/Modal";
import { Avatar, Tag } from "../ui/Display";
import { useToast } from "../ui/Toast";
import { memberUserId, nameOf, roleLabel } from "../../lib/format";
import { timeAgo } from "../../lib/time";

// Project roles an invitation can grant (mirrors the API's project role list).
const INVITE_ROLES = ["developer", "qa", "team_lead", "scrum_master", "project_manager", "client", "viewer"];

// Mirrors the permission matrix: only "project:*" (project managers) includes
// project:manage_members, plus the two platform roles that elevate inside projects.
const canManageMembers = (projectRole, systemRole) =>
  projectRole === "project_manager" || systemRole === "super_admin" || systemRole === "product_manager";

export default function ProjectMembers({ project, onProjectUpdate }) {
  const toast = useToast();
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [roleSaving, setRoleSaving] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("developer");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  const ownerId = typeof project.owner === "object" ? project.owner?._id : project.owner;

  const fetchMembers = useCallback(async () => {
    try {
      setError("");
      const res = await api.get(`/projects/${project._id}/members`);
      setMembers(Array.isArray(res?.data?.members) ? res.data.members : []);
      setInvitations(Array.isArray(res?.data?.invitations) ? res.data.invitations : []);
    } catch (err) {
      setError(err?.message || "Members could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [project._id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (e) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setInviteError("Enter the email address of an existing account.");
      return;
    }
    try {
      setInviting(true);
      setInviteError("");
      await api.post(`/projects/${project._id}/members`, { email, role: inviteRole });
      setInviteEmail("");
      toast(`Invitation sent to ${email}`);
      fetchMembers();
      onProjectUpdate();
    } catch (err) {
      setInviteError(err?.message || "The invitation could not be sent.");
    } finally {
      setInviting(false);
    }
  };

  const myRole = members.find((m) => memberUserId(m) === user?._id)?.role;
  const canManage = canManageMembers(myRole, user?.systemRole);

  const handleRoleChange = async (member, newRole) => {
    const id = memberUserId(member);
    const previous = members;
    setMembers((all) => all.map((m) => (memberUserId(m) === id ? { ...m, role: newRole } : m)));
    setRoleSaving(id);
    setError("");
    try {
      await api.put(`/projects/${project._id}/members/${id}`, { newRole });
      toast(`${nameOf(member.user)} is now ${roleLabel(newRole).toLowerCase()}`);
    } catch (err) {
      setMembers(previous);
      setError(err?.message || "The role could not be changed.");
    } finally {
      setRoleSaving(null);
    }
  };

  const handleRemove = async () => {
    await api.delete(`/projects/${project._id}/members/${memberUserId(removeTarget)}`);
    toast(`${nameOf(removeTarget.user)} removed from the project`);
    fetchMembers();
    onProjectUpdate();
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="members-heading">
        <h2 id="members-heading" className="mb-2 text-[13px] font-semibold text-text">
          Members <span className="font-normal text-subtlest">{members.length}</span>
        </h2>
        {error && <Alert className="mb-3">{error}</Alert>}
        <div className="rounded-lg border border-line bg-surface">
          {loading ? (
            <SkeletonRows rows={3} label="Loading members" />
          ) : (
            <ul className="divide-y divide-line">
              {members.map((m, i) => {
                const person = typeof m.user === "object" ? m.user : null;
                const id = memberUserId(m);
                const isOwner = id === ownerId;
                return (
                  <li key={id || i} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={nameOf(person)} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[13px] font-medium text-text">
                        {nameOf(person)}
                        {id === user?._id && <span className="font-normal text-subtlest">(you)</span>}
                        {isOwner && <Tag tone="accent">Owner</Tag>}
                      </p>
                      {person?.email && <p className="truncate text-xs text-subtlest">{person.email}</p>}
                    </div>
                    {canManage && !isOwner ? (
                      <Select
                        aria-label={`Role of ${nameOf(person)}`}
                        value={m.role}
                        disabled={roleSaving === id}
                        onChange={(e) => handleRoleChange(m, e.target.value)}
                        className="w-36 shrink-0"
                      >
                        {INVITE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="hidden text-[13px] text-subtle sm:inline">{roleLabel(m.role)}</span>
                    )}
                    {isOwner || !canManage ? (
                      <span className="w-7" aria-hidden="true" />
                    ) : (
                      <IconButton label={`Remove ${nameOf(person)}`} size="sm" tone="danger" onClick={() => setRemoveTarget(m)}>
                        <UserMinus size={14} />
                      </IconButton>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {invitations.length > 0 && (
        <section aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="mb-2 text-[13px] font-semibold text-text">
            Waiting to accept <span className="font-normal text-subtlest">{invitations.length}</span>
          </h2>
          <ul className="divide-y divide-line rounded-lg border border-dashed border-line bg-surface">
            {invitations.map((inv) => (
              <li key={inv._id ?? memberUserId(inv)} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={nameOf(inv.user)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-text">{nameOf(inv.user)}</p>
                  <p className="truncate text-xs text-subtlest">
                    {inv.user?.email}
                    {inv.invitedBy && <> &middot; invited by {nameOf(inv.invitedBy)}</>}
                    {inv.invitedAt && <> {timeAgo(inv.invitedAt)}</>}
                  </p>
                </div>
                <span className="hidden text-[13px] text-subtle sm:inline">{roleLabel(inv.role)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage && (
      <section aria-labelledby="invite-heading">
        <h2 id="invite-heading" className="text-[13px] font-semibold text-text">
          Invite someone
        </h2>
        <p className="mt-0.5 text-xs text-subtle">
          They need a Project Camp account. They join once they accept the invitation from their dashboard.
        </p>
        <form onSubmit={handleInvite} noValidate className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
          <Field label="Email address" hideLabel error={inviteError} className="flex-1">
            <Input
              type="email"
              placeholder="name@company.com"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                setInviteError("");
              }}
              autoComplete="off"
            />
          </Field>
          <Field label="Role" hideLabel className="sm:w-44">
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              {INVITE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" icon={<UserPlus size={14} />} loading={inviting}>
            Send invitation
          </Button>
        </form>
      </section>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title={`Remove ${nameOf(removeTarget?.user)}?`}
        description="They lose access to this project and are unassigned from its tasks. You can invite them again later."
        confirmLabel="Remove member"
      />
    </div>
  );
}
