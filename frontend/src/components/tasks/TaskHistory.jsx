import { memberUserId, nameOf } from "../../lib/format";
import { timeAgo } from "../../lib/time";
import { Avatar, StatusBadge } from "../ui/Display";

const idOf = (value) => (typeof value === "object" ? value?._id : value);

/** The workflow history the backend records on every status change, newest first. */
export default function TaskHistory({ transitions = [], members = [] }) {
  const names = new Map(members.map((m) => [String(memberUserId(m)), nameOf(m.user)]));
  if (transitions.length === 0) return <p className="text-[13px] text-subtlest">No changes recorded yet.</p>;
  return (
    <ol className="space-y-3">
      {[...transitions].reverse().map((t, i) => {
        const who = names.get(String(idOf(t.changedBy))) ?? "A former member";
        return (
          <li key={t._id ?? i} className="flex items-start gap-3 text-[13px]">
            <Avatar name={who} size="sm" />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-text">
                <span className="font-medium">{who}</span>
                {t.from === "none" ? (
                  <>created the issue as <StatusBadge status={t.to} /></>
                ) : (
                  <>moved <StatusBadge status={t.from} /> <span aria-hidden="true">→</span><span className="sr-only">to</span> <StatusBadge status={t.to} /></>
                )}
              </p>
              <time dateTime={t.changedAt} className="text-xs text-subtlest">{timeAgo(t.changedAt)}</time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
