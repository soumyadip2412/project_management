import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "./ui/Feedback";

/**
 * FILE: frontend/src/components/ProtectedRoute.jsx
 * Used once, in main.jsx: <ProtectedRoute><DashboardLayout/></ProtectedRoute>,
 * so it guards every /dashboard/* page at once.
 *
 * Three states:
 *   loading      → AuthContext is still asking /auth/current-user, so wait.
 *                  (Redirecting now would bounce logged-in users on every refresh.)
 *   no user      → <Navigate to="/login" replace />. `replace` swaps the history
 *                  entry, so the Back button does not return to the guarded page.
 *   user present → render the children.
 *
 * Note: this is a UX guard, not security. The real protection is the backend
 * (verifyJWT plus authorization on every API call).
 *
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
