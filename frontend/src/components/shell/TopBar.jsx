import { Link, NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, Folder, FolderPlus, Layers, LogOut, Menu as MenuIcon, Monitor, Moon, Plus, Settings, Sun } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../lib/utils";
import { Avatar } from "../ui/Display";
import BrandMark from "../ui/BrandMark";
import { Button, IconButton } from "../ui/Button";
import { Menu } from "../ui/Navigation";
import GlobalSearch from "./GlobalSearch";
import Notifications from "./Notifications";
import { GLOBAL_LINKS } from "./navigation";

/**
 * The navy global bar on every signed-in page. Inside `.surface-navy`, so
 * every token it (and its menus) uses is the navy variant.
 */
export default function TopBar({ recentProjects, onCreateIssue, onCreateProject, onOpenDrawer, drawerOpen, menuButtonRef }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { setPreference } = useTheme();
  const displayName = user?.fullName || user?.username || "Signed in";

  const projectItems = [
    ...recentProjects.map((p) => ({
      label: `${p.key} · ${p.name}`,
      icon: Folder,
      onSelect: () => navigate(`/dashboard/projects/${p._id}`),
    })),
    { label: "View all projects", icon: Layers, onSelect: () => navigate("/dashboard/projects") },
    { label: "New project", icon: FolderPlus, onSelect: onCreateProject },
  ];

  const accountItems = [
    { label: "Settings", icon: Settings, onSelect: () => navigate("/dashboard/settings") },
    { label: "Light theme", icon: Sun, onSelect: () => setPreference("light") },
    { label: "Dark theme", icon: Moon, onSelect: () => setPreference("dark") },
    { label: "Match system theme", icon: Monitor, onSelect: () => setPreference("system") },
    {
      label: "Log out",
      icon: LogOut,
      tone: "danger",
      onSelect: async () => {
        await logout();
        navigate("/login");
      },
    },
  ];

  return (
    <header className="surface-navy sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 px-3 sm:gap-3 lg:px-4">
      <IconButton
        ref={menuButtonRef}
        label="Open navigation"
        aria-expanded={drawerOpen}
        aria-controls="app-sidebar"
        onClick={onOpenDrawer}
        className="-ml-1 lg:hidden"
      >
        <MenuIcon size={18} />
      </IconButton>

      <Link to="/dashboard" className="flex shrink-0 items-center gap-2 rounded px-1 text-[13px] font-semibold text-text">
        <BrandMark />
        <span className="max-sm:sr-only">Setu</span>
      </Link>

      <nav aria-label="Global" className="ml-2 hidden h-full items-stretch gap-1 lg:flex">
        {GLOBAL_LINKS.map(({ to, label, end }) => (
          <span key={to} className="flex items-stretch">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center px-2.5 text-[13px] font-medium transition-colors",
                  isActive ? "text-text shadow-[inset_0_-2px_0_var(--topbar-accent)]" : "text-subtle hover:text-text"
                )
              }
            >
              {label}
            </NavLink>
            {to === "/dashboard/projects" && (
              <span className="flex items-center">
                <Menu
                  label="Recent projects"
                  items={projectItems}
                  align="left"
                  trigger={<ChevronDown size={14} aria-hidden="true" />}
                  triggerClassName="flex h-7 w-6 items-center justify-center rounded text-subtle hover:bg-surface-hover hover:text-text"
                />
              </span>
            )}
          </span>
        ))}
      </nav>

      <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={onCreateIssue} aria-label="Create issue" className="ml-1">
        <span className="max-sm:sr-only">Create</span>
      </Button>

      <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
        <GlobalSearch />
        <Notifications />
        <Menu
          label="Account"
          items={accountItems}
          trigger={<Avatar name={displayName} size="sm" />}
          triggerClassName="rounded-full p-0.5 hover:bg-surface-hover"
        />
      </div>
    </header>
  );
}
