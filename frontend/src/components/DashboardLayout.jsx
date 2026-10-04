import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CheckSquare,
  Folder,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { taskPath } from "../lib/format";
import { timeAgo } from "../lib/time";
import { humanizeStatuses } from "../lib/taskStatus";
import CreateProjectModal from "./CreateProjectModal";
import { Button, IconButton } from "./ui/Button";
import { Avatar, Key } from "./ui/Display";
import { useToast } from "./ui/Toast";

/* ─── Navigation ─────────────────────────────────────────────────────────────
   Every destination the app had, grouped by how often it is used: daily work
   first, organisation second, account settings last. Links (not buttons), so
   they can be opened in a new tab and are announced as navigation. */

const WORK = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/dashboard/projects", label: "Projects", icon: Folder },
  { to: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
];
const ORGANISATION = [
  { to: "/dashboard/workspaces", label: "Workspaces", icon: Layers },
  { to: "/dashboard/team", label: "Team", icon: Users },
];
const ACCOUNT = [{ to: "/dashboard/settings", label: "Settings", icon: Settings }];

function NavGroup({ items, heading }) {
  return (
    <div>
      {heading && <p className="px-2 pb-1 pt-4 text-xs text-subtlest">{heading}</p>}
      <ul className="flex flex-col gap-px">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors pointer-coarse:h-10",
                  isActive
                    ? "bg-sidebar-hover font-medium text-text"
                    : "text-subtle hover:bg-sidebar-hover hover:text-text"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? "text-primary" : "text-subtlest"} aria-hidden="true" />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Global search ──────────────────────────────────────────────────────────
   Queries the server's /search endpoint (scoped to the caller's projects) for
   projects and tasks, and opens the result directly. ⌘K / Ctrl+K focuses it. */

const SHORTCUT_HINT =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

function GlobalSearch() {
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const timer = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onPointer = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  const runSearch = (value) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get("/search", { params: { q: value.trim(), type: "project,task", limit: 5 } });
        const projects = (res?.data?.projects ?? []).map((p) => ({
          kind: "project",
          id: p._id,
          title: p.name,
          key: p.key,
          href: `/dashboard/projects/${p._id}`,
        }));
        const tasks = (res?.data?.tasks ?? []).map((t) => ({
          kind: "task",
          id: t._id,
          title: t.title,
          key: t.issueKey,
          context: t.project?.name,
          href: taskPath(t),
        }));
        setResults([...projects, ...tasks]);
        setActive(0);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  };

  const go = (r) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    navigate(r.href);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtlest" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search projects and tasks"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        placeholder="Search projects, tasks…"
        value={query}
        onChange={(e) => runSearch(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-8 w-full rounded-md border border-line bg-surface-raised pl-8 pr-12 text-[13px] text-text placeholder:text-subtlest transition-colors hover:border-line-strong focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 pointer-coarse:h-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {!query && (
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1 text-[11px] text-subtlest md:inline">
          {SHORTCUT_HINT}
        </kbd>
      )}

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-overlay"
        >
          {results.length === 0 ? (
            <p className="px-2.5 py-3 text-[13px] text-subtle">
              {searching ? "Searching…" : `Nothing matches “${query.trim()}”.`}
            </p>
          ) : (
            results.map((r, i) => (
              <div
                key={`${r.kind}-${r.id}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => {
                  e.preventDefault();
                  go(r);
                }}
                onPointerEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-[13px]",
                  i === active ? "bg-surface-hover" : ""
                )}
              >
                {r.kind === "project" ? (
                  <Folder size={14} className="shrink-0 text-subtlest" aria-hidden="true" />
                ) : (
                  <CheckSquare size={14} className="shrink-0 text-subtlest" aria-hidden="true" />
                )}
                {r.key && <Key>{r.key}</Key>}
                <span className="min-w-0 flex-1 truncate text-text">{r.title}</span>
                {r.context && <span className="hidden truncate text-xs text-subtlest sm:inline">{r.context}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Notifications ──────────────────────────────────────────────────────── */

/** Where a notification leads: its task or project, when it still exists. */
function notificationHref(n) {
  const projectId = typeof n.project === "object" ? n.project?._id : n.project;
  if (n.entityType === "task" && n.entityId && projectId) return taskPath({ _id: n.entityId, project: projectId });
  if (n.entityType === "sprint" && projectId) return `/dashboard/projects/${projectId}?tab=sprints`;
  if (n.entityType === "project" && n.entityId && n.type !== "project_deleted") return "/dashboard";
  return null;
}

function Notifications() {
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

/* ═══════════════════════════════════════════════════════════════════════════
   DashboardLayout — the shell for every /dashboard/* page
   ≥1024px: fixed sidebar + top bar. Below: the sidebar becomes a drawer
   opened from the top bar, and closes on navigation or Escape.
   ═══════════════════════════════════════════════════════════════════════════ */
export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current?.querySelector("a")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const displayName = user?.fullName || user?.username || "Signed in";

  return (
    <div className="min-h-screen bg-bg text-text lg:flex">
      <a
        href="#main"
        className="sr-only z-[70] rounded-md bg-surface px-3 py-2 text-[13px] font-medium shadow-overlay focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-[var(--surface-overlay)] lg:hidden" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      {/* ── Sidebar ── */}
      <aside
        ref={drawerRef}
        id="app-sidebar"
        aria-label="Main navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-sidebar transition-[transform,visibility] duration-200",
          "lg:visible lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-60 lg:translate-x-0",
          // Closed drawer is also invisible, so its links leave the tab order.
          drawerOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        )}
      >
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
          <Link to="/dashboard" className="flex items-center gap-2 rounded px-1 text-[13px] font-semibold text-text">
            <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded bg-text text-[11px] font-bold text-bg">
              P
            </span>
            Project Camp
          </Link>
          <IconButton label="Close navigation" size="sm" onClick={() => setDrawerOpen(false)} className="lg:hidden">
            <X size={16} />
          </IconButton>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <NavGroup items={WORK} />
          <NavGroup items={ORGANISATION} heading="Organisation" />
        </nav>

        <div className="shrink-0 border-t border-line px-2 py-2">
          <NavGroup items={ACCOUNT} />
          <div className="mt-2 flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <Avatar name={displayName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-text">{displayName}</p>
              {user?.email && <p className="truncate text-xs text-subtlest">{user.email}</p>}
            </div>
            <IconButton label="Log out" size="sm" onClick={handleLogout}>
              <LogOut size={15} />
            </IconButton>
          </div>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-line bg-bg/95 px-3 backdrop-blur-sm sm:gap-3 sm:px-4 lg:px-6">
          <IconButton
            ref={menuButtonRef}
            label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="app-sidebar"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 lg:hidden"
          >
            <MenuIcon size={18} />
          </IconButton>

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Notifications />
            <Button
              icon={<Plus size={15} />}
              onClick={() => setProjectModalOpen(true)}
              aria-label="New project"
              className="max-sm:w-8 max-sm:px-0 max-sm:pointer-coarse:w-10"
            >
              <span className="max-sm:sr-only">New project</span>
            </Button>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <CreateProjectModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onSuccess={(project) => {
          toast(`Project “${project?.name ?? "Untitled"}” created`);
          // navigate() to the route already shown does not remount it, so the
          // Projects list watches this changing state value to refetch.
          navigate("/dashboard/projects", { state: { projectCreatedAt: Date.now() } });
        }}
      />
    </div>
  );
}
