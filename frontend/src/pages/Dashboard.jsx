import { useState, useEffect, useCallback } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import CreateProjectModal from "../components/CreateProjectModal";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import CreateTaskModal from "../components/CreateTaskModal";
import InvitationsBanner from "../components/dashboard/InvitationsBanner";
import ProjectPulseCard from "../components/dashboard/ProjectPulseCard";
import RecentActivity from "../components/dashboard/RecentActivity";
import { PageHeader, Tabs, TabPanel } from "../components/ui/Navigation";
import { Button } from "../components/ui/Button";
import { Alert, EmptyState, Skeleton } from "../components/ui/Feedback";
import { useToast } from "../components/ui/Toast";
import { DueDate, Key, StatusBadge } from "../components/ui/Display";
import { taskPath } from "../lib/format";

/**
 * FILE: frontend/src/pages/Dashboard.jsx   (route: /dashboard, the index route)
 *
 * PURPOSE
 *   The signed-in home page. It loads everything from ONE backend call,
 *   GET /dashboard/stats (see backend dashboard.controller.js), plus
 *   GET /projects/invitations/me, then hands the data to small presentational
 *   components in components/dashboard/*.
 *
 * DATA FLOW (the "container / presentational" split)
 *   This page owns the state and the fetching. The children only receive props
 *   and render them, which keeps them simple and reusable.
 *
 * STATES
 *   loading (first load) → DashboardSkeleton
 *   error                → an Alert ("it will retry automatically": polled every 15 s)
 *   no projects          → one EmptyState with a "Create project" call to action
 *   normal               → project sprint cards + tabs (assigned to me / due soon / team activity)
 *
 * Accepting an invitation removes it from the list immediately, shows a toast
 * and refetches the stats (the new project now counts).
 */
function greetingFor(date) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading dashboard</span>
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-[72px] w-full rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Dashboard — the signed-in overview
// ═══════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const navigate = useNavigate();
  const refreshProjects = useOutletContext()?.refreshProjects;
  const [invitations, setInvitations] = useState([]);
  const [inviteError, setInviteError] = useState("");
  const [tab, setTab] = useState("assigned");

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/dashboard/stats");
      if (res?.data) setStats(res.data);
      setLoadError("");
    } catch (err) {
      setLoadError(err?.message || "The dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await api.get("/projects/invitations/me");
      setInvitations(res?.data?.invitations || res?.invitations || []);
    } catch {
      // Invitations are secondary; the rest of the dashboard still works.
    }
  }, []);

  const handleAcceptInvite = async (projectId) => {
    setInviteError("");
    try {
      await api.post(`/projects/${projectId}/invitations/accept`);
      const accepted = invitations.find((i) => i.projectId === projectId);
      setInvitations((prev) => prev.filter((i) => i.projectId !== projectId));
      toast(`You joined ${accepted?.projectName ?? "the project"}`);
      fetchStats();
      refreshProjects?.();
    } catch (err) {
      setInviteError(err?.message || "The invitation could not be accepted.");
    }
  };

  const handleRejectInvite = async (projectId) => {
    setInviteError("");
    try {
      await api.post(`/projects/${projectId}/invitations/reject`);
      setInvitations((prev) => prev.filter((i) => i.projectId !== projectId));
    } catch (err) {
      setInviteError(err?.message || "The invitation could not be declined.");
    }
  };

  // Initial load. Both functions are memoised with useCallback([]), so this
  // runs once on mount.
  useEffect(() => {
    fetchStats();
    fetchInvitations();
  }, [fetchStats, fetchInvitations]);

  // Keep the overview fresh without a manual refresh.
  useEffect(() => {
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // The top-bar + Create button announces new issues with this event.
  useEffect(() => {
    window.addEventListener("pc:issue-created", fetchStats);
    return () => window.removeEventListener("pc:issue-created", fetchStats);
  }, [fetchStats]);

  const firstName = (user?.fullName || user?.username || "there").split(" ")[0];
  const recentProjects = stats?.recentProjects || [];
  const recentActivities = stats?.recentActivities || [];
  const assigned = stats?.assignedToMe || [];
  const dueSoon = stats?.dueSoon || [];
  const issueList = (items, empty) =>
    items.length === 0 ? (
      <p className="px-1 py-6 text-center text-[13px] text-subtlest">{empty}</p>
    ) : (
      <ul className="divide-y divide-line rounded-md border border-line bg-surface">
        {items.map((t) => (
          <li key={t._id}>
            <Link to={taskPath(t)} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 hover:bg-surface-raised sm:grid-cols-[4.5rem_minmax(0,1fr)_auto_auto]">
              <Key>{t.issueKey}</Key>
              <span className="truncate text-[13px] text-text">{t.title}</span>
              <StatusBadge status={t.status} className="hidden sm:inline-flex" />
              <DueDate date={t.dueDate} status={t.status} empty={null} className="text-xs" />
            </Link>
          </li>
        ))}
      </ul>
    );

  if (loading && !stats) return <DashboardSkeleton />;

  const today = new Date();
  const hasProjects = (stats?.totalProjects ?? 0) > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greetingFor(today)}, ${firstName}`}
        description={today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setIsTaskModalOpen(true)}>
            New task
          </Button>
        }
      />

      {loadError && (
        <Alert>
          {loadError} It will retry automatically.
        </Alert>
      )}

      {inviteError && <Alert onDismiss={() => setInviteError("")}>{inviteError}</Alert>}
      <InvitationsBanner invitations={invitations} onAccept={handleAcceptInvite} onReject={handleRejectInvite} />

      {!hasProjects && !loadError ? (
        // A new account: one clear next step instead of a page of empty panels.
        <section className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={FolderKanban}
            title="You are not in any projects yet"
            description={
              invitations.length > 0
                ? "Join a project you were invited to above, or create your own."
                : "Create a project to start planning work, or ask a teammate to invite you to theirs."
            }
            action={
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setIsProjectModalOpen(true)}>
                Create project
              </Button>
            }
            className="py-16"
          />
        </section>
      ) : (
        <>
          <section aria-labelledby="pulse-heading">
            <h2 id="pulse-heading" className="mb-2 text-[13px] font-semibold text-text">Your projects</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {recentProjects.map((p) => <ProjectPulseCard key={p._id} project={p} />)}
            </div>
          </section>

          <section aria-label="Your issues">
            <Tabs
              label="Your issues"
              value={tab}
              onChange={setTab}
              items={[
                { id: "assigned", label: `Assigned to me ${assigned.length}` },
                { id: "due", label: `Due soon ${dueSoon.length}` },
                { id: "activity", label: "Team activity" },
              ]}
              className="mb-3"
            />
            <TabPanel id={tab}>
              {tab === "assigned" && issueList(assigned, "Nothing is assigned to you right now.")}
              {tab === "due" && issueList(dueSoon, "Nothing of yours is due in the next 7 days or overdue.")}
              {tab === "activity" && <RecentActivity items={recentActivities} />}
            </TabPanel>
          </section>
        </>
      )}

      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSuccess={(project) => {
          toast(`Project “${project?.name ?? "Untitled"}” created`);
          refreshProjects?.();
          if (project?._id) navigate(`/dashboard/projects/${project._id}`);
        }}
      />

      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSuccess={(task) => {
          toast(task?.issueKey ? `Task ${task.issueKey} created` : "Task created");
          fetchStats();
        }}
      />
    </div>
  );
}
