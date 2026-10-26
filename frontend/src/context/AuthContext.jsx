/**
 * FILE: frontend/src/context/AuthContext.jsx
 *
 * PURPOSE
 *   Global authentication state for the whole app, exposed via the useAuth() hook:
 *     user         the logged-in user object, or null
 *     loading      true until the first /auth/current-user check has finished
 *     login(email, password), register(fullName, email, password, username?) (no login: the email must be verified first),
 *     logout(), refreshUser(), updateUser(partial)
 *
 * HOW THE SESSION IS RESTORED ON PAGE LOAD
 *   The tokens are httpOnly cookies, so JavaScript cannot read them and
 *   cannot check "am I logged in?" locally. Instead, on mount we ask the
 *   server: GET /auth/current-user. 200 → user is set; 401 → user stays null.
 *   ProtectedRoute waits while `loading` is true, so a logged-in user is never
 *   bounced to /login during that first request.
 *
 * INTERVIEW NOTES
 *   Q: Why Context and not Redux?
 *   A: Auth state is small, changes rarely, and is read in many places.
 *      Context covers that without an extra library. Server data such as
 *      projects and tasks is fetched per page instead.
 *   Q: Where is the token stored on the client?
 *   A: Nowhere that JavaScript can reach: no localStorage, no memory. The browser
 *      holds it as an httpOnly cookie and sends it with credentials: "include".
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

// `undefined` default: useAuth() can detect use outside the provider and throw.
const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // useCallback keeps the same function identity across renders, so it is
  // safe in the useEffect dependency list below (it runs once on mount).
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get("/auth/current-user");
      if (res?.data) {
        setUser(res.data);
      } else if (res?.user) {
        setUser(res.user);
      }
    } catch (err) {
      // User is not authenticated
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email, password) => {
    // The server sets the session as httpOnly cookies; the body only has the user.
    const res = await api.post("/auth/login", { email, password });
    if (res?.data?.user) {
      setUser(res.data.user);
    } else {
      await refreshUser();
    }
  };

  // Registers only: login is refused until the email is verified, so the
  // Register page shows "check your inbox" instead. Without an explicit
  // username, one is generated from the email ("asha.k@x.com" → "asha_k" + up
  // to 3 random digits).
  const register = async (fullName, email, password, username) => {
    // Usernames are lowercase letters, digits and underscores (server rule).
    const autoUsername =
      username || email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 25) + Math.floor(Math.random() * 1000);
    await api.post("/auth/register", {
      fullName,
      email,
      password,
      username: autoUsername,
    });
  };

  // The server revokes the session and clears the cookies. Even if that call
  // fails, local state is cleared, so the UI never shows a "half-logged-in" state.
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout API failed, clearing local state", err);
    } finally {
      setUser(null);
    }
  };

  // Merges fields into the cached user after a profile edit, without refetching.
  const updateUser = (updatedData) => {
    setUser((prev) => (prev ? { ...prev, ...updatedData } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** The hook components use: const { user, logout } = useAuth(); */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
