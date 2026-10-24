import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

const EMPTY = { sprint: null, issues: [], loading: false, error: "" };

/** The project's active sprint and its issues (GET …/sprints?status=active, then …/sprints/:id). */
export function useActiveSprint(projectId, { enabled = true } = {}) {
  const [state, setState] = useState({ ...EMPTY, loading: enabled });

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState(EMPTY);
      return;
    }
    try {
      const list = await api.get(`/projects/${projectId}/sprints`, { params: { status: "active" } });
      const active = Array.isArray(list?.data) ? list.data[0] : null;
      if (!active) {
        setState(EMPTY);
        return;
      }
      const detail = await api.get(`/projects/${projectId}/sprints/${active._id}`);
      setState({
        sprint: detail?.data?.sprint ?? active,
        issues: Array.isArray(detail?.data?.issues) ? detail.data.issues : [],
        loading: false,
        error: "",
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err?.message || "The active sprint could not be loaded." }));
    }
  }, [projectId, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Optimistic updates from the board: same signature as a useState setter.
  const setIssues = useCallback(
    (update) => setState((s) => ({ ...s, issues: typeof update === "function" ? update(s.issues) : update })),
    []
  );

  return { ...state, refresh, setIssues };
}
