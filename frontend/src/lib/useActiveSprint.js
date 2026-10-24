import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

const EMPTY = { sprint: null, issues: [], loading: false, error: "" };

/** The project's active sprint and its issues (GET …/sprints?status=active, then …/sprints/:id). */
export function useActiveSprint(projectId, { enabled = true } = {}) {
  const [state, setState] = useState({ ...EMPTY, loading: enabled });
  // Each refresh takes a number; only the newest one may write state, so an
  // older response that resolves late is dropped.
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++latest.current;
    if (!enabled) {
      setState(EMPTY);
      return;
    }
    try {
      const list = await api.get(`/projects/${projectId}/sprints`, { params: { status: "active" } });
      if (id !== latest.current) return;
      const active = Array.isArray(list?.data) ? list.data[0] : null;
      if (!active) {
        setState(EMPTY);
        return;
      }
      const detail = await api.get(`/projects/${projectId}/sprints/${active._id}`);
      if (id !== latest.current) return;
      setState({
        sprint: detail?.data?.sprint ?? active,
        issues: Array.isArray(detail?.data?.issues) ? detail.data.issues : [],
        loading: false,
        error: "",
      });
    } catch (err) {
      if (id !== latest.current) return;
      setState((s) => ({ ...s, loading: false, error: err?.message || "The active sprint could not be loaded." }));
    }
  }, [projectId, enabled]);

  // Invalidates every request still in flight.
  const cancelPending = useCallback(() => {
    latest.current++;
  }, []);

  useEffect(() => {
    // A new project or a toggle of `enabled` drops what was shown for the old key.
    setState({ ...EMPTY, loading: enabled });
    refresh();
    return cancelPending;
  }, [refresh, enabled, cancelPending]);

  // Optimistic updates from the board: same signature as a useState setter.
  const setIssues = useCallback(
    (update) => setState((s) => ({ ...s, issues: typeof update === "function" ? update(s.issues) : update })),
    []
  );

  return { ...state, refresh, setIssues };
}
