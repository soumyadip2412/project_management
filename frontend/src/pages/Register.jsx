import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordInput from "../components/auth/PasswordInput";
import ResendVerification from "../components/auth/ResendVerification";
import SocialButtons from "../components/auth/SocialButtons";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";
import { Alert } from "../components/ui/Feedback";
import { passwordProblem } from "../lib/password";

/**
 * FILE: frontend/src/pages/Register.jsx   (route: /register)
 *
 * Sign-up form: name, email, password, confirm. It validates locally
 * (passwordProblem mirrors the backend rule), then calls useAuth().register().
 * The username is generated from the email inside AuthContext. Sign-in is
 * refused until the email is verified, so success swaps the form for a
 * "check your inbox" screen with a resend link. Google/GitHub sign-ups skip
 * this: the provider has already verified the address.
 */
export default function Register() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    const next = {};
    if (!fullName.trim()) next.fullName = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter a valid email address.";
    const problem = passwordProblem(password);
    if (problem) next.password = problem;
    if (confirmPassword !== password) next.confirmPassword = "The passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setLoading(true);
      setError("");
      await register(fullName.trim(), email.trim(), password);
      setSentTo(email.trim());
    } catch (err) {
      setError(err?.message || "Your account could not be created. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout title="Check your inbox" subtitle="One more step before you can sign in.">
        <Alert tone="success">
          We sent a verification link to <strong>{sentTo}</strong>. Open it to activate your account, then sign in.
        </Alert>
        <div className="mt-4">
          <ResendVerification email={sentTo} />
        </div>
        <p className="mt-6 text-[13px] text-subtle">
          Verified already?{" "}
          <Link to="/login" className="rounded font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="You can create a project or accept an invitation right after.">
      <form onSubmit={handleRegister} noValidate className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <Field label="Full name" error={errors.fullName}>
          <Input placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
        </Field>

        <Field label="Email address" error={errors.email}>
          <Input type="email" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>

        <Field label="Password" hint="At least 8 characters, with a letter and a number." error={errors.password}>
          <PasswordInput placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>

        <Field label="Confirm password" error={errors.confirmPassword}>
          <PasswordInput placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        </Field>

        <Button type="submit" variant="primary" loading={loading} className="w-full">
          Create account
        </Button>
      </form>

      <SocialButtons divider="or sign up with" />

      <p className="mt-6 text-[13px] text-subtle">
        Already have an account?{" "}
        <Link to="/login" className="rounded font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
