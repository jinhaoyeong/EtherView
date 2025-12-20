export type Theme = 'light' | 'dark' | 'system';

export class ThemeManager {
  private static instance: ThemeManager;
  private theme: Theme = 'light';
  private mediaQuery: MediaQueryList | null = null;
  private listeners: Array<() => void> = [];

  private constructor() {
    if (typeof window !== 'undefined') {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQuery.addEventListener('change', this.handleSystemThemeChange.bind(this));
    }
  }

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  public setTheme(theme: Theme): void {
    this.theme = theme;
    this.applyTheme();
    this.saveThemePreference();
    this.notifyListeners();
  }

  public getTheme(): Theme {
    return this.theme;
  }

  public getCurrentTheme(): 'light' | 'dark' {
    if (this.theme === 'system') {
      return this.getSystemTheme();
    }
    return this.theme;
  }

  public getSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyTheme(): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    const currentTheme = this.getCurrentTheme();

    // Remove all theme classes first
    root.classList.remove('dark', 'light');
    body.classList.remove('dark-theme');

    if (currentTheme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark-theme');
      // Use existing theme storage key for compatibility
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.add('light');
      localStorage.setItem('theme', 'light');
    }

    // Always add current theme class
    root.classList.add(currentTheme);

    // Update meta theme-color for mobile browsers
    this.updateMetaThemeColor(currentTheme);

    // Force a repaint to ensure theme is applied immediately
    void document.documentElement.offsetHeight;
  }

  private updateMetaThemeColor(theme: 'light' | 'dark'): void {
    if (typeof document === 'undefined') return;

    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.getElementsByTagName('head')[0].appendChild(metaThemeColor);
    }

    // Use appropriate theme colors for EtherView
    const themeColors = {
      light: '#ffffff', // White background for light theme
      dark: '#0a0a0a'   // Dark background for dark theme
    };

    metaThemeColor.setAttribute('content', themeColors[theme]);
  }

  private handleSystemThemeChange(): void {
    if (this.theme === 'system') {
      this.applyTheme();
      this.notifyListeners();
    }
  }

  private saveThemePreference(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('etherview_theme', this.theme);
  }

  public loadThemePreference(): void {
    if (typeof localStorage === 'undefined') return;

    // Check for etherview_theme first (new setting), fall back to theme (old setting)
    let saved = localStorage.getItem('etherview_theme') as Theme;
    if (!saved) {
      const oldTheme = localStorage.getItem('theme');
      if (oldTheme === 'dark' || oldTheme === 'light') {
        saved = oldTheme;
      }
    }

    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      this.theme = saved;
    } else {
      this.theme = 'light'; // Default to light theme
    }

    // Apply theme immediately and also sync both storage keys
    this.applyTheme();
    this.saveThemePreference();
  }

  public toggleTheme(): void {
    const current = this.getCurrentTheme();
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  }

  public addListener(callback: () => void): void {
    this.listeners.push(callback);
  }

  public removeListener(callback: () => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  public cleanup(): void {
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange.bind(this));
    }
    this.listeners = [];
  }
}

// Export singleton instance
export const themeManager = ThemeManager.getInstance();