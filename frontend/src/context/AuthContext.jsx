import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const register = async (fullName, email, password, username) => {
    // Usernames are lowercase letters, digits and underscores (server rule).
    const autoUsername =
      username || email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 25) + Math.floor(Math.random() * 1000);
    const res = await api.post("/auth/register", {
      fullName,
      email,
      password,
      username: autoUsername,
    });
    // Attempt login right after registration
    try {
      await login(email, password);
    } catch {
      if (res?.data?.user) {
        setUser(res.data.user);
      }
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout API failed, clearing local state", err);
    } finally {
      setUser(null);
    }
  };

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
