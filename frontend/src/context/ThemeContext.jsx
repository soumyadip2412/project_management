import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "theme";

const ThemeContext = createContext(undefined);

function readStoredPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Private mode or blocked storage — fall back to the system preference.
  }
  return "system";
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
