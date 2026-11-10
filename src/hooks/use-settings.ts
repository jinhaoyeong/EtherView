"use client";

import { useState, useEffect, useCallback } from "react";
import { themeManager, type Theme } from "@/lib/theme-manager";

export interface UserSettings {
  appearance: {
    theme: Theme;
    language: string;
    currency: string;
    compactMode: boolean;
    animationsEnabled: boolean;
  };
  display: {
    showBalance: boolean;
    showUSDValues: boolean;
    show24hChange: boolean;
    showTransactionFees: boolean;
    defaultTimeRange: "1h" | "24h" | "7d" | "30d" | "1y";
    itemsPerPage: number;
    isCustomItemsPerPage: boolean;
  };
  data: {
    autoRefresh: boolean;
    refreshInterval: number;
    useTestnetData: boolean;
    enableAnimations: boolean;
    showTooltips: boolean;
    isCustomRefreshInterval: boolean;
  };
  storage: {
    clearCacheOnReload: boolean;
    rememberWalletAddress: boolean;
    rememberFilters: boolean;
    exportDataFormat: "json" | "csv";
  };
}

const SETTINGS_KEY = "etherview_settings";
const SETTINGS_EVENT = "etherview:settings-changed";
const DEFAULT_SETTINGS: UserSettings = {
  appearance: {
    theme: "dark",
    language: "en",
    currency: "USD",
    compactMode: false,
    animationsEnabled: true,
  },
  display: {
    showBalance: true,
    showUSDValues: true,
    show24hChange: true,
    showTransactionFees: true,
    defaultTimeRange: "24h",
    itemsPerPage: 50,
    isCustomItemsPerPage: false,
  },
  data: {
    autoRefresh: true,
    refreshInterval: 30,
    useTestnetData: false,
    enableAnimations: true,
    showTooltips: true,
    isCustomRefreshInterval: false,
  },
  storage: {
    clearCacheOnReload: false,
    rememberWalletAddress: true,
    rememberFilters: true,
    exportDataFormat: "json",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Imported files and browser storage are untrusted: copy only known, typed fields.
function validateSettings(value: unknown): UserSettings {
  const result = structuredClone(DEFAULT_SETTINGS);
  if (!isRecord(value)) return result;
  for (const category of Object.keys(result) as (keyof UserSettings)[]) {
    const input = value[category];
    if (!isRecord(input)) continue;
    const defaults = result[category] as Record<string, unknown>;
    for (const key of Object.keys(defaults)) {
      if (typeof input[key] === typeof defaults[key])
        defaults[key] = input[key];
    }
  }
  if (!["dark", "light", "system"].includes(result.appearance.theme))
    result.appearance.theme = DEFAULT_SETTINGS.appearance.theme;
  if (!["en", "zh", "ms", "ja"].includes(result.appearance.language))
    result.appearance.language = "en";
  // Other currencies previously used hard-coded example rates. Keep valuations in their source currency.
  result.appearance.currency = "USD";
  if (
    !["1h", "24h", "7d", "30d", "1y"].includes(result.display.defaultTimeRange)
  )
    result.display.defaultTimeRange = "24h";
  result.display.itemsPerPage = Number.isFinite(result.display.itemsPerPage)
    ? Math.min(100, Math.max(10, Math.round(result.display.itemsPerPage)))
    : 50;
  result.data.refreshInterval = Number.isFinite(result.data.refreshInterval)
    ? Math.min(300, Math.max(10, Math.round(result.data.refreshInterval)))
    : 30;
  if (!["json", "csv"].includes(result.storage.exportDataFormat))
    result.storage.exportDataFormat = "json";
  return result;
}

function readSettings(): UserSettings {
  const stored = localStorage.getItem(SETTINGS_KEY);
  const result = validateSettings(
    stored ? JSON.parse(stored) : DEFAULT_SETTINGS,
  );
  const theme =
    localStorage.getItem("etherview_theme") || localStorage.getItem("theme");
  if (theme === "dark" || theme === "light" || theme === "system")
    result.appearance.theme = theme;
  return result;
}

function removeAppStorage(cacheOnly = false) {
  const preserved = new Set([
    SETTINGS_KEY,
    "etherview_theme",
    "etherview_wallet",
  ]);
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("etherview_") && (!cacheOnly || !preserved.has(key)))
      localStorage.removeItem(key);
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(() => {
    try {
      const next = readSettings();
      setSettings(next);
      themeManager.setTheme(next.appearance.theme, false);
      setError(null);
    } catch {
      setSettings(structuredClone(DEFAULT_SETTINGS));
      setError(
        "Saved preferences could not be read. Default settings are active.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSettings = useCallback((newSettings: UserSettings) => {
    try {
      const next = validateSettings(newSettings);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      if (!next.storage.rememberWalletAddress)
        localStorage.removeItem("etherview_wallet");
      themeManager.setTheme(next.appearance.theme);
      setSettings(next);
      setError(null);
      window.dispatchEvent(new Event(SETTINGS_EVENT));
      return true;
    } catch {
      setError("Your browser could not save these preferences.");
      return false;
    }
  }, []);

  const updateSetting = useCallback(
    (category: keyof UserSettings, key: string, value: unknown) => {
      try {
        // Read the latest saved value to avoid overwriting another mounted hook's updates.
        const current = readSettings();
        if (!(key in current[category])) return;
        saveSettings({
          ...current,
          [category]: { ...current[category], [key]: value },
        });
      } catch {
        setError("Your browser could not save this preference.");
      }
    },
    [saveSettings],
  );

  const resetSettings = useCallback(
    () => saveSettings(structuredClone(DEFAULT_SETTINGS)),
    [saveSettings],
  );

  const exportSettings = useCallback(
    () =>
      settings
        ? { settings, exportedAt: new Date().toISOString(), version: "1.0" }
        : null,
    [settings],
  );

  const importSettings = useCallback(
    (data: unknown) => {
      if (!isRecord(data) || !isRecord(data.settings)) {
        setError("Choose an EtherView settings JSON file.");
        return false;
      }
      return saveSettings(validateSettings(data.settings));
    },
    [saveSettings],
  );

  const clearAllData = useCallback(() => {
    try {
      removeAppStorage();
      themeManager.setTheme(DEFAULT_SETTINGS.appearance.theme);
      setSettings(structuredClone(DEFAULT_SETTINGS));
      window.dispatchEvent(new Event(SETTINGS_EVENT));
      return true;
    } catch {
      setError("Your browser could not clear EtherView data.");
      return false;
    }
  }, []);

  const clearCache = useCallback(() => {
    try {
      removeAppStorage(true);
      window.dispatchEvent(new Event("etherview:cache-cleared"));
      return true;
    } catch {
      setError("Your browser could not clear EtherView cached data.");
      return false;
    }
  }, []);

  useEffect(() => {
    loadSettings();
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === SETTINGS_KEY ||
        event.key === "etherview_theme" ||
        event.key === null
      )
        loadSettings();
    };
    const onTheme = () =>
      setSettings((current) =>
        current
          ? {
              ...current,
              appearance: {
                ...current.appearance,
                theme: themeManager.getTheme(),
              },
            }
          : current,
      );
    window.addEventListener(SETTINGS_EVENT, loadSettings);
    window.addEventListener("storage", onStorage);
    themeManager.addListener(onTheme);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, loadSettings);
      window.removeEventListener("storage", onStorage);
      themeManager.removeListener(onTheme);
    };
  }, [loadSettings]);

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    root.classList.toggle("compact-mode", settings.appearance.compactMode);
    root.classList.toggle(
      "no-animations",
      !settings.appearance.animationsEnabled || !settings.data.enableAnimations,
    );
    root.classList.toggle("hide-balance", !settings.display.showBalance);
    root.classList.toggle("hide-usd-values", !settings.display.showUSDValues);
    root.classList.toggle("hide-24h-change", !settings.display.show24hChange);
    root.classList.toggle(
      "hide-transaction-fees",
      !settings.display.showTransactionFees,
    );
    root.classList.toggle("no-tooltips", !settings.data.showTooltips);
  }, [settings]);

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
    reloadSettings: loadSettings,
  };
}
