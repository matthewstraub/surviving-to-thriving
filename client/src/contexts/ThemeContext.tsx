import React, { createContext, useContext, useEffect, useState } from "react";

/** The theme actually applied to the page. */
type Theme = "light" | "dark";

/** What the viewer has asked for. "system" defers to their OS setting. */
export type ThemePreference = Theme | "system";

const STORAGE_KEY = "theme";

interface ThemeContextType {
  /** The resolved theme currently on the page. */
  theme: Theme;
  /** What was asked for — "system" when following the OS. */
  preference: ThemePreference;
  /** Set an explicit theme, or "system" to resume following the OS. */
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function systemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function storedPreference(): ThemePreference | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : null;
  } catch {
    // Private browsing and blocked site data both throw here.
    return null;
  }
}

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Defaults to following the viewer's OS setting. */
  defaultTheme?: ThemePreference;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => storedPreference() ?? defaultTheme
  );
  const [resolved, setResolved] = useState<Theme>(() =>
    preference === "system" ? systemTheme() : preference
  );

  // Follow the OS while the preference is "system" — this fires when the
  // viewer flips their system theme with the page already open, which on
  // macOS happens automatically at sunset.
  useEffect(() => {
    if (preference !== "system") {
      setResolved(preference);
      return;
    }

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setResolved(query.matches ? "dark" : "light");
    apply();

    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [preference]);

  // The `.dark` class is what the palette in index.css keys off.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    try {
      if (next === "system") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // Preference simply will not persist; the page still themes correctly.
    }
  };

  return (
    <ThemeContext.Provider
      value={{ theme: resolved, preference, setPreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
