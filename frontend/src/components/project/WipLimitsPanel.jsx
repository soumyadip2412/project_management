import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { memberUserId } from "../../lib/format";
import { BOARD_COLUMNS, STATUS_META } from "../../lib/taskStatus";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Field";
import { Alert } from "../ui/Feedback";
import { useToast } from "../ui/Toast";

// Mirrors the permission matrix: project:update for these project roles.
const EDITORS = new Set(["project_manager", "scrum_master", "team_lead"]);

export default function WipLimitsPanel({ project, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const limits = project.settings?.wipLimits ?? {};
    setValues(Object.fromEntries(BOARD_COLUMNS.map((s) => [s, String(limits[s] ?? 0)])));
  }, [project]);

  const myRole = project.members?.find((m) => memberUserId(m) === user?._id)?.role;
  if (!EDITORS.has(myRole) && !["super_admin", "product_manager"].includes(user?.systemRole)) return null;

  const submit = async (e) => {
    e.preventDefault();
    const parsed = {};
    for (const s of BOARD_COLUMNS) {
      const n = Number(values[s] === "" ? 0 : values[s]);
      if (!Number.isInteger(n) || n < 0 || n > 99) {
        setError(`${STATUS_META[s].label}: use a whole number from 0 to 99.`);
        return;
      }
      parsed[s] = n;
    }
    try {
      setSaving(true);
      setError("");
      await api.put(`/projects/${project._id}`, { wipLimits: parsed });
      toast("WIP limits saved");
      onSaved();
    } catch (err) {
      setError(err?.message || "The limits could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="wip-heading" className="mt-8 rounded-md border border-line bg-surface p-4">
      <h2 id="wip-heading" className="text-[13px] font-semibold text-text">WIP limits</h2>
      <p className="mt-1 text-[13px] text-subtle">
        The most issues a board column should hold. A column over its limit turns red; moves are never blocked. 0 means no limit.
      </p>
      <form onSubmit={submit} noValidate className="mt-4">
        {error && <Alert className="mb-3">{error}</Alert>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BOARD_COLUMNS.map((s) => (
            <Field key={s} label={`${STATUS_META[s].label} limit`}>
              <Input type="number" min={0} max={99} inputMode="numeric" value={values[s] ?? "0"} onChange={(e) => setValues({ ...values, [s]: e.target.value })} />
            </Field>
          ))}
        </div>
        <div className="mt-4">
          <Button type="submit" variant="primary" size="sm" loading={saving}>Save limits</Button>
        </div>
      </form>
    </section>
  );
}
