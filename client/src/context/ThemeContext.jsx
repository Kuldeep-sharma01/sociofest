import React, { createContext, useState, useEffect, useContext } from "react";

const ThemeContext = createContext();

export const THEMES = [
  { id: "default", name: "Default Indigo" },
  { id: "whatsapp", name: "WhatsApp Classic" },
  { id: "discord", name: "Discord Dark" },
  { id: "midnight", name: "Midnight Ocean" },
  { id: "hacker", name: "Hacker Terminal" },
  { id: "sunset", name: "Sunset Warmth" },
  { id: "cyberpunk", name: "Neon Cyberpunk" },
  { id: "dracula", name: "Dracula Dark" },
  { id: "ocean", name: "Ocean Breeze" },
];

export const ThemeProvider = ({ children }) => {
  // Initialize state based on localStorage OR the user's system preferences
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const dark = (
        localStorage.getItem("theme") === "dark" ||
        (!("theme" in localStorage) &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
      if (dark) {
        window.document.documentElement.classList.add("dark");
      } else {
        window.document.documentElement.classList.remove("dark");
      }
      return dark;
    }
    return false;
  });

  const [appTheme, setAppTheme] = useState(() => {
    const theme = localStorage.getItem("appTheme") || "default";
    if (typeof document !== "undefined") {
      document.body.setAttribute("data-theme", theme);
    }
    return theme;
  });

  const [is3DMode, setIs3DMode] = useState(() => {
    // Default to true for the "exceptional" experience the user wants
    const saved = localStorage.getItem("is3DMode");
    return saved === null ? true : saved === "true";
  });

  // Automatically apply the 'dark' class to the HTML root when state changes
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem("appTheme", appTheme);
    document.body.setAttribute("data-theme", appTheme);
  }, [appTheme]);

  useEffect(() => {
    localStorage.setItem("is3DMode", is3DMode);
    const root = window.document.documentElement;
    if (is3DMode) {
      root.classList.add("is-3d-mode");
    } else {
      root.classList.remove("is-3d-mode");
    }
  }, [is3DMode]);

  const toggleTheme = () => setIsDark(!isDark);
  const toggle3DMode = () => setIs3DMode(!is3DMode);

  return (
    <ThemeContext.Provider
      value={{ isDark, toggleTheme, appTheme, setAppTheme, is3DMode, toggle3DMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
