/**
 * FILE: frontend/src/context/ThemeContext.jsx
 *
 * PURPOSE
 *   Light/dark mode for the whole app, via useTheme():
 *     preference   what the user chose: "light" | "dark" | "system"
 *     theme        what is actually shown: "light" | "dark"
 *     setPreference(p), toggle()
 *
 * HOW THEMING WORKS
 *   applyTheme() adds or removes the `dark` class on <html>. index.css defines
 *   the colour tokens twice, for :root and for .dark, so every Tailwind utility
 *   such as `bg-surface` switches colour automatically. No component needs
 *   to know which theme is active.
 *
 * DETAILS
 *   - The preference is persisted in localStorage (every access is wrapped in
 *     try/catch because storage can be blocked, e.g. in private mode).
 *   - The default is "light"; dark mode or "system" is an explicit choice.
 *   - "system" follows the OS setting live through matchMedia's change event;
 *     the effect's cleanup function removes the listener when the preference
 *     changes or the provider unmounts (no memory leak).
 *   - index.html has a tiny inline script that applies the stored theme before
 *     React loads (no light "flash" in dark mode); this provider keeps it in
 *     sync afterwards.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "theme";

const ThemeContext = createContext(undefined);

function readStoredPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Private mode or blocked storage — fall back to the default.
  }
  // Light until the person picks something else (Account menu or Settings).
  return "light";
}

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(preference) {
  return preference === "system" ? systemTheme() : preference;
}

/** Applies the theme to <html>, which is what the `.dark` CSS variants key off. */
function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  // Lets the browser style native controls (scrollbars, form widgets) correctly.
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }) {
  // Passing the FUNCTION (not its result) makes React call it only on the
  // first render ("lazy initial state").
  const [preference, setPreferenceState] = useState(readStoredPreference);
  const [theme, setTheme] = useState(() => resolve(readStoredPreference()));

  useEffect(() => {
    const next = resolve(preference);
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Not persisting is acceptable; the session still renders correctly.
    }
  }, [preference]);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = systemTheme();
      setTheme(next);
      applyTheme(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  // toggle() flips relative to what is currently SHOWN, and stores an explicit
  // choice ("light"/"dark"), which ends "system" mode.
  const setPreference = useCallback((next) => setPreferenceState(next), []);
  const toggle = useCallback(
    () => setPreferenceState(resolve(readStoredPreference()) === "dark" ? "light" : "dark"),
    []
  );

  return (
    <ThemeContext.Provider value={{ preference, theme, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
