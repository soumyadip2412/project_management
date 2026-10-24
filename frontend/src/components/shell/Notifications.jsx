import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { taskPath } from "../../lib/format";
import { timeAgo } from "../../lib/time";
import { humanizeStatuses } from "../../lib/taskStatus";
import { IconButton } from "../ui/Button";

/** Where a notification leads: its task or project, when it still exists. */
function notificationHref(n) {
  const projectId = typeof n.project === "object" ? n.project?._id : n.project;
  if (n.entityType === "task" && n.entityId && projectId) return taskPath({ _id: n.entityId, project: projectId });
  if (n.entityType === "sprint" && projectId) return `/dashboard/projects/${projectId}/backlog`;
  if (n.entityType === "project" && n.entityId && n.type !== "project_deleted") return "/dashboard";
  return null;
}

export default function Notifications() {
  const panelId = useId();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchUnread = useCallback(async () => {
    try {
      const res = await api.get("/notifications/unread-count");
      setUnread(res?.data?.unreadCount ?? 0);
    } catch {
      // A failed badge refresh is not worth interrupting anyone; the next poll retries.
    }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/notifications");
      const list = res?.data?.notifications ?? [];
      setItems(Array.isArray(list) ? list.slice(0, 10) : []);
    } catch (err) {
      setError(err?.message || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      setError(err?.message || "Could not mark notifications as read.");
    }
  };

  // Opening a notification marks just that one as read; the list and badge
  // update straight away, and a failed request is retried by the next poll.
  const markRead = (n) => {
    if (n.isRead || !n._id) return;
    setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    api.put(`/notifications/${n._id}/read`).catch(() => fetchUnread());
  };

  // Poll the unread count every 15 s (there are no WebSockets). Fetch once
  // immediately, then on the interval; clear it on unmount.
  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The list itself is fetched lazily, only when the panel opens.
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) fetchItems();
  };

  return (
    <div ref={ref} className="relative">
      <IconButton
        label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className="relative"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-bg bg-primary px-0.5 text-[9px] font-semibold leading-none text-primary-contrast"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </IconButton>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Notifications"
          className="fixed inset-x-3 top-14 z-40 max-h-[70vh] overflow-y-auto rounded-md border border-line bg-surface shadow-overlay sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-96"
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-3 py-2">
            <h2 className="text-[13px] font-semibold text-text">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="rounded text-xs font-medium text-primary hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          {error ? (
            <p role="alert" className="px-3 py-4 text-[13px] text-danger">{error}</p>
          ) : loading && items.length === 0 ? (
            <p className="px-3 py-4 text-[13px] text-subtle">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-subtle">You're all caught up.</p>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((n, i) => {
                const href = notificationHref(n);
                const content = (
                  <>
                    <span
                      aria-hidden="true"
                      className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-primary")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-[13px] text-text", !n.isRead && "font-medium")}>
                        {humanizeStatuses(n.title || n.message || "Notification")}
                        {!n.isRead && <span className="sr-only"> (unread)</span>}
                      </span>
                      {n.body && <span className="mt-0.5 block truncate text-xs text-subtle">{n.body}</span>}
                      <span className="mt-0.5 block text-xs text-subtlest">{timeAgo(n.createdAt)}</span>
                    </span>
                  </>
                );
                return (
                  <li key={n._id || i}>
                    {href ? (
                      <Link
                        to={href}
                        onClick={() => {
                          markRead(n);
                          setOpen(false);
                        }}
                        className="flex gap-2.5 px-3 py-2.5 hover:bg-surface-hover"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex gap-2.5 px-3 py-2.5">
                        {content}
                        {!n.isRead && (
                          <button type="button" onClick={() => markRead(n)} className="shrink-0 self-start rounded text-xs font-medium text-primary hover:underline">
                            Mark as read
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

