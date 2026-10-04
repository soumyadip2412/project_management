import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordInput from "../components/auth/PasswordInput";
import { api } from "../lib/api";
import { passwordProblem } from "../lib/password";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { Alert } from "../components/ui/Feedback";

/**
 * Landing page for the link in the password-reset email
 * (FORGOT_PASSWORD_REDIRECT_URL + "/" + token). The token is single-use and
 * expires; the server also ends every existing session on success.
 */
export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    const problem = passwordProblem(password);
    if (problem) next.password = problem;
    if (confirmPassword !== password) next.confirmPassword = "The passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setLoading(true);
      setError("");
      await api.post(`/auth/reset-password/${encodeURIComponent(token)}`, { newPassword: password });
      navigate("/login", { replace: true, state: { notice: "Your password has been reset. Sign in with the new password." } });
    } catch (err) {
      setError(
        err?.statusCode === 400
          ? "This reset link is invalid or has expired. Request a new one from the sign-in page."
          : err?.message || "The password could not be reset. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password" subtitle="You will be signed out on every device.">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <Field label="New password" hint="At least 8 characters, with a letter and a number." error={errors.password}>
          <PasswordInput
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
        </Field>

        <Field label="Confirm new password" error={errors.confirmPassword}>
          <PasswordInput
            placeholder="Repeat the password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        <Button type="submit" variant="primary" loading={loading} className="w-full">
          Reset password
        </Button>
      </form>

      <p className="mt-6 text-[13px] text-subtle">
        <Link to="/login" className="rounded font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
