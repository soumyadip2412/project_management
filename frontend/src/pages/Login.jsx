import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordInput from "../components/auth/PasswordInput";
import SocialButtons from "../components/auth/SocialButtons";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";
import { Alert } from "../components/ui/Feedback";

const RESET_MESSAGE = "If an account exists for that address, we have sent it a link to reset the password.";

export default function Login() {
  const navigate = useNavigate();
  // Set by pages that finish elsewhere and send the user here (e.g. password reset).
  const notice = useLocation().state?.notice;
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    const next = {};
    if (!email.trim()) next.email = "Enter your email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setLoading(true);
      setError("");
      await login(email.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      setError(err?.message || "Sign-in failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError("Enter the email address you sign in with.");
      return;
    }
    try {
      setForgotLoading(true);
      setForgotError("");
      await api.post("/auth/forgot-password", { email: forgotEmail.trim() });
    } catch {
      // Same answer either way, so the page never reveals whether an account exists.
    } finally {
      setForgotLoading(false);
      setForgotSent(true);
    }
  };

  if (showForgot) {
    return (
      <AuthLayout title="Reset your password" subtitle="We will email you a link to choose a new one.">
        {forgotSent ? (
          <Alert tone="success">{RESET_MESSAGE}</Alert>
        ) : (
          <form onSubmit={handleForgotPassword} noValidate className="space-y-4">
            <Field label="Email address" error={forgotError}>
              <Input
                type="email"
                placeholder="Enter your registered email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </Field>
            <Button type="submit" variant="primary" loading={forgotLoading} className="w-full">
              Send reset link
            </Button>
          </form>
        )}
        <button
          type="button"
          onClick={() => {
            setShowForgot(false);
            setForgotSent(false);
            setForgotError("");
          }}
          className="mt-5 rounded text-[13px] font-medium text-primary hover:underline"
        >
          Back to sign in
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Sign in to Project Camp" subtitle="Welcome back.">
      <form onSubmit={handleLogin} noValidate className="space-y-4">
        {notice && !error && <Alert tone="success">{notice}</Alert>}
        {error && <Alert>{error}</Alert>}

        <Field label="Email address" error={errors.email}>
          <Input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="login-password" className="text-xs font-medium text-subtle">
              Password
            </label>
            <button
              type="button"
              onClick={() => {
                setShowForgot(true);
                setForgotEmail(email);
              }}
              className="rounded text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <PasswordInput
            id="login-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "login-password-error" : undefined}
          />
          {errors.password && (
            <p id="login-password-error" className="text-xs text-danger">
              {errors.password}
            </p>
          )}
        </div>

        <Button type="submit" variant="primary" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>

      <SocialButtons divider="or continue with" />

      <p className="mt-6 text-[13px] text-subtle">
        New to Project Camp?{" "}
        <Link to="/register" className="rounded font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
