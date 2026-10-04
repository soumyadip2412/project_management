/** "Ada Lovelace" → "AL"; "ada" → "AD"; empty → "?" */
export function initialsOf(name) {
  const clean = (name ?? "").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : clean.slice(0, 2)).toUpperCase();
}

/** Display name for a user object as the API returns it (fullName, then username). */
export function nameOf(user) {
  return user?.fullName || user?.username || user?.email || "Unknown user";
}

const ROLE_LABELS = {
  project_manager: "Project manager",
  scrum_master: "Scrum master",
  team_lead: "Team lead",
  developer: "Developer",
  qa: "QA",
  client: "Client",
  viewer: "Viewer",
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  guest: "Guest",
};

/** "project_manager" → "Project manager". Unknown roles are shown as sent. */
export function roleLabel(role) {
  if (!role) return "Member";
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

const PROJECT_STATUS_LABELS = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

export function projectStatusLabel(status) {
  return PROJECT_STATUS_LABELS[status ?? "active"] ?? String(status);
}

export function formatDate(input, withYear = false) {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
}

/** Project id from a task whose `project` may be populated or a bare id. */
export function projectIdOf(task) {
  const p = task.project;
  return (typeof p === "object" ? p?._id : p) ?? "";
}

export function taskPath(task) {
  return `/dashboard/tasks/${task._id}?projectId=${projectIdOf(task)}`;
}

/** The member entry (populated user) matching the project's owner, if loaded. */
export function findOwner(project) {
  const ownerId = typeof project.owner === "object" ? project.owner?._id : project.owner;
  const entry = project.members?.find((m) => {
    const u = m.user;
    return (typeof u === "object" ? u?._id : u) === ownerId;
  });
  return typeof entry?.user === "object" ? entry.user : typeof project.owner === "object" ? project.owner : null;
}

/** Id of a member entry's user, whether or not it is populated. */
export function memberUserId(member) {
  const u = member.user;
  return (typeof u === "object" ? u?._id : u) ?? "";
}
