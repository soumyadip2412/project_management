import { Folder, House, Layers, Users } from "lucide-react";

/** Top-level destinations: the top bar on desktop, the drawer's first section on phones. */
export const GLOBAL_LINKS = Object.freeze([
  { to: "/dashboard", label: "Your work", icon: House, end: true },
  { to: "/dashboard/projects", label: "Projects", icon: Folder },
  { to: "/dashboard/workspaces", label: "Workspaces", icon: Layers },
  { to: "/dashboard/team", label: "Team", icon: Users },
]);
