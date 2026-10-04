import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Alert, Spinner } from "../components/ui/Feedback";

/**
 * Landing page for the link in the verification email
 * (EMAIL_VERIFICATION_REDIRECT_URL + "/" + token). Works signed in or out.
 */
export default function VerifyEmail() {
  const { token } = useParams();
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState("pending"); // pending | verified | failed
  const [message, setMessage] = useState("");
  // The token is single-use: StrictMode runs effects twice in development, and
  // a second request would report the just-used token as invalid.
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    api
      .get(`/auth/verify-email/${encodeURIComponent(token)}`)
      .then(() => {
        setState("verified");
        refreshUser(); // a signed-in user's isEmailVerified changes
      })
      .catch((err) => {
        setState("failed");
        setMessage(
          err?.statusCode === 400
            ? "This verification link is invalid, has expired or was already used."
            : err?.message || "Your email could not be verified. Please try again."
        );
      });
  }, [token, refreshUser]);

  const next = user ? { to: "/dashboard", label: "Go to the dashboard" } : { to: "/login", label: "Sign in" };

  return (
    <AuthLayout title="Verify your email">
      {state === "pending" && (
        <p className="flex items-center gap-2 text-[13px] text-subtle">
          <Spinner label="Verifying your email" /> Checking your link…
        </p>
      )}
      {state === "verified" && <Alert tone="success">Your email address is verified.</Alert>}
      {state === "failed" && (
        <Alert>
          {message} {user ? "You can send a new link from Settings." : "Sign in to send a new link from Settings."}
        </Alert>
      )}

      {state !== "pending" && (
        <p className="mt-6 text-[13px] text-subtle">
          <Link to={next.to} className="rounded font-medium text-primary hover:underline">
            {next.label}
          </Link>
        </p>
      )}
    </AuthLayout>
  );
}
