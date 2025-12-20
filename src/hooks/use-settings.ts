"use client";

import { useState, useEffect, useCallback } from 'react';
import { themeManager, Theme } from '@/lib/theme-manager';

export interface UserSettings {
  // Appearance Settings
  appearance: {
    theme: Theme;
    language: string;
    currency: string;
    compactMode: boolean;
    animationsEnabled: boolean;
  };

  // Display Preferences
  display: {
    showBalance: boolean;
    showUSDValues: boolean;
    show24hChange: boolean;
    showTransactionFees: boolean;
    defaultTimeRange: '1h' | '24h' | '7d' | '30d' | '1y';
    itemsPerPage: number;
    isCustomItemsPerPage: boolean;
  };

  // Data Preferences
  data: {
    autoRefresh: boolean;
    refreshInterval: number; // seconds
    useTestnetData: boolean;
    enableAnimations: boolean;
    showTooltips: boolean;
    isCustomRefreshInterval: boolean;
  };

  // Local Storage Settings
  storage: {
    clearCacheOnReload: boolean;
    rememberWalletAddress: boolean;
    rememberFilters: boolean;
    exportDataFormat: 'json' | 'csv';
  };
}

const DEFAULT_SETTINGS: UserSettings = {
  appearance: {
    theme: 'system',
    language: 'en',
    currency: 'USD',
    compactMode: false,
    animationsEnabled: true
  },
  display: {
    showBalance: true,
    showUSDValues: true,
    show24hChange: true,
    showTransactionFees: true,
    defaultTimeRange: '24h',
    itemsPerPage: 50,
    isCustomItemsPerPage: false
  },
  data: {
    autoRefresh: true,
    refreshInterval: 30,
    useTestnetData: false,
    enableAnimations: true,
    showTooltips: true,
    isCustomRefreshInterval: false
  },
  storage: {
    clearCacheOnReload: false,
    rememberWalletAddress: true,
    rememberFilters: true,
    exportDataFormat: 'json'
  }
};

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings from localStorage
  const loadSettings = useCallback(() => {
    try {
      setLoading(true);
      setError(null);

      const savedSettings = localStorage.getItem("etherview_settings");
      const loadedSettings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;

      const validatedSettings = {
        appearance: { ...DEFAULT_SETTINGS.appearance, ...loadedSettings.appearance },
        display: { ...DEFAULT_SETTINGS.display, ...loadedSettings.display },
        data: { ...DEFAULT_SETTINGS.data, ...loadedSettings.data },
        storage: { ...DEFAULT_SETTINGS.storage, ...loadedSettings.storage }
      };

      const themePref = localStorage.getItem('etherview_theme') || localStorage.getItem('theme');
      if (themePref === 'light' || themePref === 'dark') {
        validatedSettings.appearance.theme = themePref as Theme;
      }

      setSettings(validatedSettings);

      themeManager.setTheme(validatedSettings.appearance.theme);

    } catch (err) {
      setError("Failed to load settings");
      console.error('Settings load error:', err);
      // Set default settings on error
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = useCallback(async (newSettings: UserSettings) => {
    try {
      setError(null);

      // Save to localStorage
      localStorage.setItem("etherview_settings", JSON.stringify(newSettings));

      // Apply theme if changed
      if (newSettings.appearance.theme !== settings?.appearance.theme) {
        themeManager.setTheme(newSettings.appearance.theme);
      }

      // Apply compact mode if changed
      if (newSettings.appearance.compactMode !== settings?.appearance.compactMode) {
        document.documentElement.classList.toggle('compact-mode', newSettings.appearance.compactMode);
      }

      // Apply animations setting if changed
      if (newSettings.appearance.animationsEnabled !== settings?.appearance.animationsEnabled) {
        document.documentElement.classList.toggle('no-animations', !newSettings.appearance.animationsEnabled);
      }

      setSettings(newSettings);
      return true;
    } catch (err) {
      setError("Failed to save settings");
      console.error('Settings save error:', err);
      return false;
    }
  }, [settings]);

  // Update a specific setting
  const updateSetting = useCallback((
    category: keyof UserSettings,
    key: string,
    value: unknown
  ) => {
    if (!settings) return;

    const newSettings = {
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value
      }
    };

    // Apply theme immediately if it's the theme setting
    if (category === 'appearance' && key === 'theme') {
      const v = typeof value === 'string' && (value === 'light' || value === 'dark' || value === 'system') ? value : 'system';
      themeManager.setTheme(v as Theme);
    }

    // Save to localStorage
    localStorage.setItem("etherview_settings", JSON.stringify(newSettings));
    setSettings(newSettings);
  }, [settings]);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    try {
      localStorage.removeItem("etherview_settings");
      localStorage.removeItem("etherview_theme");
      themeManager.setTheme('system');
      document.documentElement.classList.remove('compact-mode');
      document.documentElement.classList.remove('no-animations');
      setSettings(DEFAULT_SETTINGS);
    } catch (err) {
      setError("Failed to reset settings");
      console.error('Settings reset error:', err);
    }
  }, []);

  // Export settings
  const exportSettings = useCallback(() => {
    if (!settings) return null;

    const exportData = {
      settings,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    return exportData;
  }, [settings]);

  // Import settings
  const importSettings = useCallback((importedData: unknown) => {
    try {
      const data = importedData as { settings?: Partial<UserSettings> };
      if (!data.settings) {
        throw new Error("Invalid settings file format");
      }

      // Validate imported settings
      const validatedSettings = {
        appearance: { ...DEFAULT_SETTINGS.appearance, ...(data.settings.appearance || {}) },
        display: { ...DEFAULT_SETTINGS.display, ...(data.settings.display || {}) },
        data: { ...DEFAULT_SETTINGS.data, ...(data.settings.data || {}) },
        storage: { ...DEFAULT_SETTINGS.storage, ...(data.settings.storage || {}) }
      };

      saveSettings(validatedSettings);
      return true;
    } catch (err) {
      setError("Failed to import settings. Please check the file format.");
      console.error('Settings import error:', err);
      return false;
    }
  }, [saveSettings]);

  // Clear all data
  const clearAllData = useCallback(() => {
    try {
      // Get the wallet address before clearing (in case we need to preserve it for disconnect logic)
      

      // Clear everything except what we explicitly want to preserve during the clear operation
      localStorage.clear();

      // Reset theme and document classes
      themeManager.setTheme('system');
      document.documentElement.classList.remove('compact-mode');
      document.documentElement.classList.remove('no-animations');

      // Reset settings to defaults
      setSettings(DEFAULT_SETTINGS);

      console.log('🧹 Cleared all localStorage data and reset settings');
      return true;
    } catch (err) {
      setError("Failed to clear data");
      console.error('Clear data error:', err);
      return false;
    }
  }, []);

  // Clear cache only (preserve settings and wallet)
  const clearCache = useCallback(() => {
    try {
      const walletAddress = localStorage.getItem("etherview_wallet");
      const settingsData = localStorage.getItem("etherview_settings");
      const themeData = localStorage.getItem("etherview_theme");

      localStorage.clear();

      // Restore important data
      if (walletAddress) localStorage.setItem("etherview_wallet", walletAddress);
      if (settingsData) localStorage.setItem("etherview_settings", settingsData);
      if (themeData) localStorage.setItem("etherview_theme", themeData);

      return true;
    } catch (err) {
      setError("Failed to clear cache");
      console.error('Clear cache error:', err);
      return false;
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Apply settings classes whenever settings change
  useEffect(() => {
    if (!settings) return;

    const root = document.documentElement;

    // Apply settings classes to document
    root.classList.toggle('compact-mode', settings.appearance.compactMode);
    root.classList.toggle('no-animations', !settings.appearance.animationsEnabled);
    root.classList.toggle('hide-balance', !settings.display.showBalance);
    root.classList.toggle('hide-usd-values', !settings.display.showUSDValues);
    root.classList.toggle('hide-24h-change', !settings.display.show24hChange);
    root.classList.toggle('hide-transaction-fees', !settings.display.showTransactionFees);
    root.classList.toggle('no-tooltips', !settings.data.showTooltips);
    root.classList.toggle('settings-transition', true); // Enable smooth transitions for settings changes

    // Add temporary class for visual feedback
    root.classList.add('settings-updating');
    setTimeout(() => {
      root.classList.remove('settings-updating');
    }, 300);

  }, [settings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      themeManager.cleanup();
    };
  }, []);

  return {
    settings,
    loading,
    error,
    saveSettings,
    updateSetting,
    resetSettings,
    exportSettings,
    importSettings,
    clearAllData,
    clearCache,
    reloadSettings: loadSettings
  };
}
