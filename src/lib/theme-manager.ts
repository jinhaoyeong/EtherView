export type Theme = "light" | "dark" | "system";

export class ThemeManager {
  private static instance: ThemeManager;
  private theme: Theme = "dark";
  private mediaQuery: MediaQueryList | null = null;
  private listeners = new Set<() => void>();

  private constructor() {}

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) ThemeManager.instance = new ThemeManager();
    return ThemeManager.instance;
  }

  private ensureSystemListener(): void {
    if (typeof window === "undefined" || this.mediaQuery) return;
    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.mediaQuery.addEventListener("change", this.handleSystemThemeChange);
  }

  public setTheme(theme: Theme, persist = true): void {
    const changed = this.theme !== theme;
    this.theme = theme;
    this.ensureSystemListener();
    this.applyTheme();
    try {
      if (persist) localStorage.setItem("etherview_theme", this.theme);
    } catch {
      /* Theme still works without storage. */
    }
    if (changed) this.notifyListeners();
  }

  public getTheme(): Theme {
    return this.theme;
  }

  public getCurrentTheme(): "light" | "dark" {
    return this.theme === "system" ? this.getSystemTheme() : this.theme;
  }

  public getSystemTheme(): "light" | "dark" {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  private applyTheme(): void {
    if (typeof document === "undefined") return;
    const current = this.getCurrentTheme();
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(current);
    // Remove the old second dark palette: it used to override the active design tokens.
    document.body.classList.remove("dark-theme");
    document.documentElement.style.colorScheme = current;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", current === "dark" ? "#101216" : "#f4f6fa");
  }

  private handleSystemThemeChange = (): void => {
    if (this.theme === "system") {
      this.applyTheme();
      this.notifyListeners();
    }
  };

  public loadThemePreference(): void {
    let saved: string | null = null;
    try {
      saved =
        localStorage.getItem("etherview_theme") ||
        localStorage.getItem("theme");
    } catch {
      /* Use the default. */
    }
    this.setTheme(
      saved === "light" || saved === "dark" || saved === "system"
        ? saved
        : "dark",
      false,
    );
  }

  public toggleTheme(): void {
    this.setTheme(this.getCurrentTheme() === "dark" ? "light" : "dark");
  }
  public addListener(callback: () => void): void {
    this.listeners.add(callback);
  }
  public removeListener(callback: () => void): void {
    this.listeners.delete(callback);
  }
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  public cleanup(): void {
    this.mediaQuery?.removeEventListener(
      "change",
      this.handleSystemThemeChange,
    );
    this.mediaQuery = null;
  }
}

export const themeManager = ThemeManager.getInstance();
