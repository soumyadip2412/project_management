import { createContext, useContext } from "react";

/** The project loaded once by ProjectLayout, shared with every project page. */
export const ProjectContext = createContext(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used inside <ProjectLayout>");
  return ctx;
}
