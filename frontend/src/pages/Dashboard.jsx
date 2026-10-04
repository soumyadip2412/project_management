import { useState, useEffect, useCallback } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CreateProjectModal from "../components/CreateProjectModal";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import CreateTaskModal from "../components/CreateTaskModal";
import InvitationsBanner from "../components/dashboard/InvitationsBanner";
import MetricStrip from "../components/dashboard/MetricCard";
import WorkProgressChart from "../components/dashboard/WorkProgressChart";
import UpcomingDeadlines from "../components/dashboard/UpcomingDeadlines";
import MyTasksTable from "../components/dashboard/MyTasksTable";
import RecentActivity from "../components/dashboard/RecentActivity";
import ActiveProjects from "../components/dashboard/ActiveProjects";
import { PageHeader } from "../components/ui/Navigation";
import { Button } from "../components/ui/Button";
import { Alert, EmptyState, Skeleton } from "../components/ui/Feedback";
import { useToast } from "../components/ui/Toast";

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
  const [invitations, setInvitations] = useState([]);
  const [inviteError, setInviteError] = useState("");

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

  useEffect(() => {
    fetchStats();
    fetchInvitations();
  }, [fetchStats, fetchInvitations]);

  // Keep the overview fresh without a manual refresh.
  useEffect(() => {
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const firstName = (user?.fullName || user?.username || "there").split(" ")[0];
  const recentProjects = stats?.recentProjects || [];
  const inDevTasks = stats?.pipeline?.inDevelopment || [];
  const reviewTasks = stats?.pipeline?.reviewPending || [];
  const completedTasks = stats?.pipeline?.completed || [];
  const recentActivities = stats?.recentActivities || [];

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
      <MetricStrip
        metrics={[
          { label: "Projects", value: stats?.totalProjects ?? 0 },
          { label: "Active tasks", value: stats?.activeTasks ?? 0, sub: `${inDevTasks.length} in progress` },
          {
            label: "Completion",
            value: `${stats?.completionRate ?? 0}%`,
            sub: `${stats?.completedTasks ?? 0} of ${stats?.totalTasks ?? 0} tasks done`,
          },
          { label: "People", value: stats?.teamMembers ?? 1, sub: "across your projects" },
        ]}
      />

      {/* What is moving (left) next to what is due and where (right). */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <MyTasksTable inProgress={inDevTasks} review={reviewTasks} completed={completedTasks} />
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-1">
          <UpcomingDeadlines tasks={[...inDevTasks, ...reviewTasks]} />
          <ActiveProjects projects={recentProjects} />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <WorkProgressChart projects={recentProjects} />
        <RecentActivity items={recentActivities} />
      </div>
        </>
      )}

      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSuccess={(project) => {
          toast(`Project “${project?.name ?? "Untitled"}” created`);
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
