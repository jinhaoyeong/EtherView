"use client";

import { useRef, useState } from "react";
import { ResearchHeader } from "@/components/shared/research-header";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useSettings } from "@/hooks/use-settings";
import { useWallet } from "@/contexts/wallet-context";
import {
  Check,
  Download,
  Info,
  Laptop,
  Moon,
  RefreshCw,
  Shield,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";

const categories = [
  { id: "appearance", label: "Appearance" },
  { id: "display", label: "Display" },
  { id: "data", label: "Data & refresh" },
  { id: "storage", label: "Privacy & storage" },
];

function SettingRow({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border/70 py-5 last:border-0">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function SettingsPage() {
  const { walletAddress, handleDisconnect } = useWallet();
  const {
    settings,
    loading,
    error,
    updateSetting,
    resetSettings,
    exportSettings: getExport,
    importSettings,
    clearAllData,
    clearCache,
  } = useSettings();
  const [activeTab, setActiveTab] = useState("appearance");
  const [notice, setNotice] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const exportSettings = () => {
    const data = getExport();
    if (!data) return;
    const csv = settings?.storage.exportDataFormat === "csv";
    const flat: Record<string, unknown> = {};
    for (const [group, values] of Object.entries(data.settings)) {
      for (const [key, value] of Object.entries(values))
        flat[`${group}.${key}`] = value;
    }
    const quote = (value: unknown) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const content = csv
      ? `${Object.keys(flat).map(quote).join(",")}\n${Object.values(flat).map(quote).join(",")}`
      : JSON.stringify(data, null, 2);
    const url = URL.createObjectURL(
      new Blob([content], { type: csv ? "text/csv" : "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `etherview-settings-${new Date().toISOString().slice(0, 10)}.${csv ? "csv" : "json"}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      "Settings exported. Use JSON when you want to import them again.",
    );
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setNotice(null);
    const file = event.target.files?.[0];
    if (!file) return;
    setFileError(null);
    try {
      if (file.size > 100_000)
        throw new Error("Choose a settings JSON file smaller than 100 KB.");
      if (importSettings(JSON.parse(await file.text())))
        setNotice("Your imported preferences are now active.");
    } catch (err) {
      setFileError(
        err instanceof SyntaxError
          ? "This file is not valid JSON. Choose an exported EtherView settings file."
          : err instanceof Error
            ? err.message
            : "Could not read that file.",
      );
    } finally {
      event.target.value = "";
    }
  };

  return (
    <DashboardLayout
      walletAddress={walletAddress || ""}
      onDisconnect={handleDisconnect}
    >
      <div className="workspace-page research-page space-y-8">
        <ResearchHeader
          index="06"
          category="Make it yours"
          title="Settings"
          description="A workspace that feels right. Fine-tune its appearance, data, and privacy."
          tone="lime"
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={exportSettings}
              disabled={!settings}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Import JSON
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              aria-label="Import settings JSON"
              onChange={importFile}
            />
          </div>
        </ResearchHeader>

        {notice && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="flex-1">{notice}</p>
            <button
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
              className="text-muted-foreground"
            >
              Dismiss
            </button>
          </div>
        )}
        {(error || fileError) && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {fileError || error}
          </p>
        )}

        <div className="settings-workbench">
        <nav
          aria-label="Settings categories"
          className="settings-rail"
        >
          {categories.map(({ id, label }, index) => (
            <button
              key={id}
              aria-pressed={activeTab === id}
              onClick={() => setActiveTab(id)}
            >
              <span aria-hidden="true">0{index + 1}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {loading || !settings ? (
          <div
            role="status"
            aria-label="Loading settings"
            className="h-96 animate-pulse rounded-lg bg-muted"
          />
        ) : (
          <div className="settings-content">
            <section className="surface-panel min-w-0 p-5 sm:p-6">
              {activeTab === "appearance" && (
                <>
                  <p className="eyebrow">LOOK & FEEL</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">
                    Appearance
                  </h2>
                  <p className="mb-6 mt-2 text-sm text-muted-foreground">
                    Choose a theme and adjust interface preferences.
                  </p>
                  <fieldset>
                    <legend className="mb-3 text-sm font-medium">
                      Color theme
                    </legend>
                    <div className="appearance-choices">
                      {(
                        [
                          { value: "light", name: "Light", icon: Sun },
                          { value: "dark", name: "Dark", icon: Moon },
                          { value: "system", name: "System", icon: Laptop },
                        ] as const
                      ).map(({ value, name, icon: Icon }) => (
                        <button
                          type="button"
                          key={value}
                          aria-pressed={settings.appearance.theme === value}
                          onClick={() =>
                            updateSetting("appearance", "theme", value)
                          }
                          className="appearance-choice"
                          data-theme={value}
                        >
                          <span className="appearance-preview" aria-hidden="true" />
                          <span className="appearance-label">
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {name}
                          </span>
                          {settings.appearance.theme === value && (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="my-8 grid gap-6 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="language">Interface language</Label>
                      <Select
                        value={settings.appearance.language}
                        onValueChange={(value) =>
                          updateSetting("appearance", "language", value)
                        }
                      >
                        <SelectTrigger id="language" className="mt-2 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="zh">中文</SelectItem>
                          <SelectItem value="ms">Bahasa Melayu</SelectItem>
                          <SelectItem value="ja">日本語</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Translations apply to supported interface labels.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="currency">Valuation currency</Label>
                      <Select value="USD" disabled>
                        <SelectTrigger id="currency" className="mt-2 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD · US Dollar</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        Prices remain in their source currency, USD. Live
                        currency conversion is not connected.
                      </p>
                    </div>
                  </div>
                  <SettingRow
                    id="compact"
                    title="Compact spacing"
                    description="Fit more information into your workspace."
                    checked={settings.appearance.compactMode}
                    onChange={(value) =>
                      updateSetting("appearance", "compactMode", value)
                    }
                  />
                  <SettingRow
                    id="animations"
                    title="Interface motion"
                    description="Use transitions and animated loading states."
                    checked={settings.appearance.animationsEnabled}
                    onChange={(value) => {
                      updateSetting("appearance", "animationsEnabled", value);
                      updateSetting("data", "enableAnimations", value);
                    }}
                  />
                </>
              )}

              {activeTab === "display" && (
                <>
                  <p className="eyebrow">INFORMATION DENSITY</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">
                    Display
                  </h2>
                  <p className="mb-4 mt-2 text-sm text-muted-foreground">
                    Choose which values appear in your wallet view.
                  </p>
                  {(
                    [
                      {
                        key: "showBalance",
                        title: "Balances",
                        description:
                          "Show portfolio and token balances in wallet views.",
                      },
                      {
                        key: "showUSDValues",
                        title: "USD valuations",
                        description: "Show fiat values beside token amounts.",
                      },
                      {
                        key: "showTransactionFees",
                        title: "Transaction fees",
                        description:
                          "Include gas costs in the activity ledger.",
                      },
                    ] as const
                  ).map(({ key, title, description }) => (
                    <SettingRow
                      key={key}
                      id={key}
                      title={title}
                      description={description}
                      checked={settings.display[key]}
                      onChange={(value) => updateSetting("display", key, value)}
                    />
                  ))}
                  <SettingRow
                    id="custom-count"
                    title="Custom transaction list size"
                    description="Choose the number of transfers loaded per transaction page."
                    checked={settings.display.isCustomItemsPerPage}
                    onChange={(value) =>
                      updateSetting("display", "isCustomItemsPerPage", value)
                    }
                  />
                  <div className="mt-4">
                    <Label htmlFor="count">
                      {settings.display.itemsPerPage} items per page
                    </Label>
                    <Slider
                      id="count"
                      aria-label="Items per page"
                      className="mt-4"
                      value={[settings.display.itemsPerPage]}
                      min={10}
                      max={100}
                      step={10}
                      disabled={!settings.display.isCustomItemsPerPage}
                      onValueChange={([value]) =>
                        updateSetting("display", "itemsPerPage", value)
                      }
                    />
                  </div>
                </>
              )}

              {activeTab === "data" && (
                <>
                  <p className="eyebrow">DATA PREFERENCES</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">
                    Data & refresh
                  </h2>
                  <p className="mb-4 mt-2 text-sm text-muted-foreground">
                    Balance fresh data with provider usage.
                  </p>
                  <SettingRow
                    id="refresh"
                    title="Automatic refresh"
                    description="Periodically refresh active views while you work."
                    checked={settings.data.autoRefresh}
                    onChange={(value) =>
                      updateSetting("data", "autoRefresh", value)
                    }
                  />
                  <SettingRow
                    id="custom-interval"
                    title="Custom refresh interval"
                    description="Use the same refresh interval across supported views."
                    checked={settings.data.isCustomRefreshInterval}
                    onChange={(value) =>
                      updateSetting("data", "isCustomRefreshInterval", value)
                    }
                  />
                  <div className="py-6">
                    <Label htmlFor="interval">
                      {settings.data.refreshInterval} seconds between refreshes
                    </Label>
                    <Slider
                      id="interval"
                      aria-label="Refresh interval in seconds"
                      value={[settings.data.refreshInterval]}
                      min={10}
                      max={300}
                      step={10}
                      className="mt-5"
                      disabled={!settings.data.isCustomRefreshInterval}
                      onValueChange={([value]) =>
                        updateSetting("data", "refreshInterval", value)
                      }
                    />
                    <p className="mt-3 text-xs text-muted-foreground">
                      When custom intervals are off, each view uses its own
                      default.
                    </p>
                  </div>
                  <SettingRow
                    id="tooltips"
                    title="Helpful tooltips"
                    description="Show contextual hints on supported controls."
                    checked={settings.data.showTooltips}
                    onChange={(value) =>
                      updateSetting("data", "showTooltips", value)
                    }
                  />
                  <div className="mt-6 flex gap-3 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      EtherView reads Ethereum mainnet. Freshness and coverage
                      depend on the configured data providers.
                    </p>
                  </div>
                </>
              )}

              {activeTab === "storage" && (
                <>
                  <p className="eyebrow">PRIVACY & STORAGE</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">
                    Privacy & storage
                  </h2>
                  <p className="mb-4 mt-2 text-sm text-muted-foreground">
                    Manage the preferences and addresses saved on this device.
                  </p>
                  <SettingRow
                    id="remember"
                    title="Remember wallet address"
                    description="Restore your last viewed address on your next visit. Turning this off removes the saved address."
                    checked={settings.storage.rememberWalletAddress}
                    onChange={(value) =>
                      updateSetting("storage", "rememberWalletAddress", value)
                    }
                  />
                  <div className="my-6">
                    <Label htmlFor="format">Settings export format</Label>
                    <Select
                      value={settings.storage.exportDataFormat}
                      onValueChange={(value) =>
                        updateSetting("storage", "exportDataFormat", value)
                      }
                    >
                      <SelectTrigger id="format" className="mt-2 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">
                          JSON · backup and import
                        </SelectItem>
                        <SelectItem value="csv">
                          CSV · spreadsheet reference
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="my-6 flex gap-3 rounded-lg bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Preferences are stored in this browser. Wallet addresses
                      and analysis requests are sent to the configured
                      blockchain and analysis providers. EtherView never needs
                      your private key.
                    </p>
                  </div>
                  <div className="space-y-4 border-t border-border pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-medium">
                          Clear saved cache
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Remove EtherView browser cache entries; retain
                          preferences and address.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (clearCache())
                            setNotice(
                              "Saved EtherView cache entries cleared. Active data will refresh normally.",
                            );
                        }}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Clear cache
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                      <div>
                        <h3 className="text-sm font-medium">
                          Remove all EtherView data
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Forget your address and reset this workspace.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="text-destructive"
                        onClick={() => {
                          if (
                            confirm(
                              "Remove EtherView preferences, cached data, and the remembered wallet address from this browser?",
                            )
                          ) {
                            handleDisconnect();
                            clearAllData();
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove data
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </section>
            <aside className="space-y-6 text-sm">
              <div className="surface-panel p-5">
                <span className="mb-3 inline-flex text-primary">
                  <Check className="h-4 w-4" />
                </span>
                <h2 className="font-semibold">Saved in this browser</h2>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  Preferences apply immediately and stay in this browser. No
                  account required.
                </p>
              </div>
              <div className="surface-panel p-5">
                <h2 className="font-medium">Reset settings</h2>
                <p className="mb-4 mt-2 leading-relaxed text-muted-foreground">
                  Return to EtherView’s default workspace preferences.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (
                      confirm(
                        "Reset all workspace preferences to their defaults?",
                      )
                    ) {
                      if (resetSettings())
                        setNotice("Default workspace preferences restored.");
                    }
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset preferences
                </Button>
              </div>
            </aside>
          </div>
        )}
        </div>
      </div>
    </DashboardLayout>
  );
}
