import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordInput from "../components/auth/PasswordInput";
import SocialButtons from "../components/auth/SocialButtons";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";
import { Alert } from "../components/ui/Feedback";
import { passwordProblem } from "../lib/password";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      navigate("/dashboard");
    } catch (err) {
      setError(err?.message || "Your account could not be created. Try again.");
    } finally {
      setLoading(false);
    }
  };

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
