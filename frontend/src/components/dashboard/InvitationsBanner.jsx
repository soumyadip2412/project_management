import { useState } from "react";
import { Button } from "../ui/Button";
import { roleLabel, nameOf } from "../../lib/format";

/** Pending project invitations — the one thing on the dashboard that waits for an answer. */
export default function InvitationsBanner({
  invitations,
  onAccept,
  onReject,
}) {
  const [busy, setBusy] = useState(null);
  if (invitations.length === 0) return null;

  const run = async (id, action) => {
    setBusy(id);
    try {
      await action(id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Pending invitations" className="rounded-lg border border-primary/30 bg-primary-subtle/50">
      <ul className="divide-y divide-primary/15">
        {invitations.map((inv) => (
          <li key={inv.projectId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="min-w-0 text-[13px] text-text">
              <span className="font-medium">{nameOf(inv.invitedBy) === "Unknown user" ? "Someone" : nameOf(inv.invitedBy)}</span>{" "}
              invited you to <span className="font-medium">{inv.projectName}</span> as{" "}
              {roleLabel(inv.role).toLowerCase()}.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" onClick={() => run(inv.projectId, onReject)} disabled={busy === inv.projectId}>
                Decline
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => run(inv.projectId, onAccept)}
                loading={busy === inv.projectId}
              >
                Join project
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
