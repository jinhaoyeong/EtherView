"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { themeManager } from "@/lib/theme-manager";

export function DarkModeToggle() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Load theme preference from theme manager
    const currentTheme = themeManager.getCurrentTheme();
    setDarkMode(currentTheme === 'dark');

    // Listen for theme changes
    const handleThemeChange = () => {
      const newTheme = themeManager.getCurrentTheme();
      setDarkMode(newTheme === 'dark');
    };

    themeManager.addListener(handleThemeChange);

    return () => {
      themeManager.removeListener(handleThemeChange);
    };
  }, []);

  const handleToggle = () => {
    const current = themeManager.getCurrentTheme();
    // Toggle between light and dark, not system
    themeManager.setTheme(current === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      onClick={handleToggle}
      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background hover:opacity-90 ${
        darkMode
          ? "bg-muted border-2 border-border/50 shadow-sm"
          : "bg-muted border-2 border-border/30"
      }`}
      aria-label="Toggle dark mode"
    >
      <span className="sr-only">Toggle dark mode</span>
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-primary transition-transform duration-300 ease-in-out ${
          darkMode ? "translate-x-7" : "translate-x-1"
        }`}
      >
        <span className="flex h-full w-full items-center justify-center">
          {darkMode ? (
            <Sun className="h-4 w-4 text-primary-foreground" />
          ) : (
            <Moon className="h-4 w-4 text-primary-foreground" />
          )}
        </span>
      </span>
    </button>
  );
}
