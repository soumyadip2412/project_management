import { Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { Panel } from "../ui/Navigation";
import { Avatar } from "../ui/Display";
import { EmptyState } from "../ui/Feedback";
import { timeAgo } from "../../lib/time";
import { nameOf } from "../../lib/format";

/*
 * Audit actions as the second half of a sentence. With a target the sentence
 * names it ("created PAY-9 Apple Pay"); without one (the thing was deleted)
 * it falls back to the kind of thing ("deleted a task").
 */
const VERBS = {
  created: { task: "created", comment: "commented on", sprint: "created", project: "created", note: "wrote the note" },
  updated: { task: "updated", comment: "edited a comment on", sprint: "updated", project: "updated", note: "edited the note" },
  deleted: { comment: "deleted a comment on" },
  member_invited: { member: "invited" },
  member_added: { member: "added" },
  member_removed: { member: "removed" },
  role_changed: { member: "changed the role of" },
  sprint_started: { sprint: "started" },
  sprint_completed: { sprint: "completed" },
};

const GENERIC = {
  created: (e) => `created a ${e}`,
  updated: (e) => `updated a ${e}`,
  deleted: (e) => `deleted a ${e}`,
  member_invited: () => "invited someone to a project",
  member_added: () => "added a member",
  member_removed: () => "removed a member",
  role_changed: () => "changed a member's role",
  sprint_started: () => "started a sprint",
  sprint_completed: () => "completed a sprint",
  permission_changed: () => "changed a user's system role",
};

function generic(action, entityType) {
  const entity = (entityType || "item").replace(/_/g, " ");
  const phrase = GENERIC[action ?? ""];
  return phrase ? phrase(entity) : `${(action || "changed").replace(/_/g, " ")} a ${entity}`;
}

function targetHref(target) {
  if (target.type === "task" && target.taskId) return `/dashboard/tasks/${target.taskId}?projectId=${target.projectId}`;
  if (target.type === "sprint" && target.projectId) return `/dashboard/projects/${target.projectId}?tab=sprints`;
  if (target.type === "member" && target.projectId) return `/dashboard/projects/${target.projectId}?tab=members`;
  if (target.projectId) return `/dashboard/projects/${target.projectId}`;
  return null;
}

function Description({ activity }) {
  const { action, entityType, target } = activity;
  const verb = target && VERBS[action]?.[entityType];
  if (!verb) return generic(action, entityType);

  const href = targetHref(target);
  const name = href ? (
    <Link to={href} className="font-medium text-text hover:text-primary hover:underline">
      {target.label}
    </Link>
  ) : (
    <span className="font-medium text-text">{target.label}</span>
  );
  return (
    <>
      {verb} {name}
    </>
  );
}

/** The audit log for the caller's projects: who did what to which thing, and when. */
export default function RecentActivity({ items }) {
  return (
    <Panel title="Activity">
      {items.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" description="Changes across your projects are recorded here." className="py-8" />
      ) : (
        <ol className="divide-y divide-line">
          {items.map((a, i) => {
            const actor = nameOf(a.actor);
            return (
              <li key={a._id || i} className="flex items-start gap-2.5 px-4 py-2.5">
                <Avatar name={actor} size="sm" />
                <p className="min-w-0 flex-1 text-[13px] text-subtle [overflow-wrap:anywhere]">
                  <span className="font-medium text-text">{actor}</span> <Description activity={a} />
                </p>
                <time dateTime={a.createdAt} className="shrink-0 text-xs text-subtlest">
                  {timeAgo(a.createdAt)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
