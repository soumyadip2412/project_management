import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "./ui/Feedback";

/**
 * ProtectedRoute — wraps any route that requires authentication.
 * While the session check runs it shows a quiet loading state; once resolved,
 * signed-out visitors are redirected to /login.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-bg text-[13px] text-subtle">
        <Spinner label="Checking your session" />
        <span aria-hidden="true">Checking your session…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
