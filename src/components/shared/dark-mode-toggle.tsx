"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { themeManager } from "@/lib/theme-manager";
export function DarkModeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(themeManager.getCurrentTheme() === "dark");
    sync();
    themeManager.addListener(sync);
    return () => themeManager.removeListener(sync);
  }, []);
  return (
    <button
      className="appearance-toggle"
      onClick={() => themeManager.toggleTheme()}
      aria-label={dark ? "Use light appearance" : "Use dark appearance"}
      title={dark ? "Use light appearance" : "Use dark appearance"}
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
