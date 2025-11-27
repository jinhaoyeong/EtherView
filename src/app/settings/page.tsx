"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSettings } from "@/hooks/use-settings";
import { useTranslation } from "@/hooks/use-translation";
import { useWallet } from "@/contexts/wallet-context";
import {
  Settings,
  Sun,
  Moon,
  Globe,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Eye,
  Shield,
  Check,
  X,
  Info,
  AlertTriangle
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('appearance');
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const { walletAddress, handleDisconnect } = useWallet();

  const {
    settings,
    loading,
    error,
    updateSetting,
    resetSettings,
    exportSettings: exportSettingsData,
    importSettings,
    clearAllData,
    clearCache
  } = useSettings();

  
  // Show success message
  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Export settings to file
  const exportSettings = () => {
    const data = exportSettingsData();
    if (!data) return;

    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `etherview_settings_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    showSuccess("Settings exported successfully!");
  };

  // Import settings from file
  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        const success = importSettings(imported);
        if (success) {
          showSuccess("Settings imported successfully!");
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      } catch {
        showSuccess("Failed to import settings. Please check the file format.");
      }
    };
    reader.readAsText(file);
  };

  // Handle reset with confirmation
  const handleResetSettings = () => {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      resetSettings();
      showSuccess("Settings reset to defaults!");
    }
  };

  // Handle clear all data with confirmation
  const handleClearAllData = () => {
    if (confirm("Are you sure you want to clear all local data? This will remove your settings, cached data, and remembered wallet address.")) {
      // Disconnect wallet first to clear context state
      handleDisconnect();
      const success = clearAllData();
      if (success) {
        showSuccess("All data cleared successfully!");
        setTimeout(() => window.location.reload(), 2000);
      }
    }
  };

  // Handle clear cache
  const handleClearCache = () => {
    const success = clearCache();
    if (success) {
      showSuccess("Cache cleared successfully!");
    }
  };

  if (loading) {
    return (
      <DashboardLayout walletAddress={walletAddress || ''} onDisconnect={handleDisconnect}>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-96 bg-muted rounded"></div>
              <div className="h-96 bg-muted rounded"></div>
              <div className="h-96 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !settings) {
    return (
      <DashboardLayout walletAddress={walletAddress || ''} onDisconnect={handleDisconnect}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout walletAddress={walletAddress || ''} onDisconnect={handleDisconnect}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('settings.subtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={exportSettings}
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportSettings}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={handleResetSettings}
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <X className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Settings Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <Card className="bg-card border-border p-6 shadow-lg lg:col-span-1">
            <h3 className="font-semibold mb-4">Settings Categories</h3>
            <nav className="space-y-2">
              {[
                { id: 'appearance', label: t('settings.appearance'), icon: Sun },
                { id: 'display', label: t('settings.display'), icon: Eye },
                { id: 'data', label: t('settings.data'), icon: RefreshCw },
                { id: 'storage', label: t('settings.storage'), icon: Shield }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
          </Card>

          {/* Settings Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Appearance Settings */}
            {activeTab === 'appearance' && settings && (
              <Card className="bg-card border-border p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Sun className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">{t('settings.appearance')}</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <Select
                      value={settings.appearance.theme}
                      onValueChange={(value: 'light' | 'dark' | 'system') =>
                        updateSetting('appearance', 'theme', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">
                          <div className="flex items-center gap-2">
                            <Sun className="h-4 w-4" />
                            {t('theme.light')}
                          </div>
                        </SelectItem>
                        <SelectItem value="dark">
                          <div className="flex items-center gap-2">
                            <Moon className="h-4 w-4" />
                            {t('theme.dark')}
                          </div>
                        </SelectItem>
                        <SelectItem value="system">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            {t('theme.system')}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select
                        value={settings.appearance.language}
                        onValueChange={(value) =>
                          updateSetting('appearance', 'language', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="zh">中文 (Chinese)</SelectItem>
                          <SelectItem value="ms">Bahasa Melayu (Malay)</SelectItem>
                          <SelectItem value="ja">Japanese</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select
                        value={settings.appearance.currency}
                        onValueChange={(value) =>
                          updateSetting('appearance', 'currency', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="JPY">JPY (¥)</SelectItem>
                          <SelectItem value="ETH">ETH (Ξ)</SelectItem>
                          <SelectItem value="BTC">BTC (₿)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { key: 'compactMode', label: 'Compact Mode', description: 'Show more content with reduced spacing' },
                      { key: 'animationsEnabled', label: 'Enable Animations', description: 'Smooth transitions and animations throughout the app' }
                    ].map(({ key, label, description }) => (
                      <div key={key} className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>{label}</Label>
                          <p className="text-sm text-muted-foreground">{description}</p>
                        </div>
                        <Switch
                          checked={settings.appearance[key as keyof typeof settings.appearance] as boolean}
                          onCheckedChange={(checked) =>
                            updateSetting('appearance', key, checked)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Display Settings */}
            {activeTab === 'display' && settings && (
              <Card className="bg-card border-border p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Display Preferences</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    {[
                      { key: 'showBalance', label: 'Show Balance', description: 'Display wallet balance in the dashboard' },
                      { key: 'showUSDValues', label: 'Show USD Values', description: 'Display USD equivalent values alongside crypto amounts' },
                      { key: 'show24hChange', label: 'Show 24h Changes', description: 'Display 24-hour price changes' },
                      { key: 'showTransactionFees', label: 'Show Transaction Fees', description: 'Display gas fees in transaction list' }
                    ].map(({ key, label, description }) => (
                      <div key={key} className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>{label}</Label>
                          <p className="text-sm text-muted-foreground">{description}</p>
                        </div>
                        <Switch
                          checked={settings.display[key as keyof typeof settings.display] as boolean}
                          onCheckedChange={(checked) =>
                            updateSetting('display', key, checked)
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Default Time Range</Label>
                      <Select
                        value={settings.display.defaultTimeRange}
                        onValueChange={(value: '1h' | '24h' | '7d' | '30d' | '1y') =>
                          updateSetting('display', 'defaultTimeRange', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1h">1 Hour</SelectItem>
                          <SelectItem value="24h">24 Hours</SelectItem>
                          <SelectItem value="7d">7 Days</SelectItem>
                          <SelectItem value="30d">30 Days</SelectItem>
                          <SelectItem value="1y">1 Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Items Per Page: {settings.display.itemsPerPage}</Label>
                      <Slider
                        value={[settings.display.itemsPerPage]}
                        onValueChange={([value]) => updateSetting('display', 'itemsPerPage', value)}
                        max={100}
                        min={10}
                        step={10}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Data & Refresh Settings */}
            {activeTab === 'data' && settings && (
              <Card className="bg-card border-border p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Data & Refresh Settings</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    {[
                      { key: 'autoRefresh', label: 'Auto Refresh', description: 'Automatically refresh data at regular intervals' },
                      { key: 'useTestnetData', label: 'Use Testnet Data', description: 'Use testnet data for testing purposes' },
                      { key: 'enableAnimations', label: 'Enable Animations', description: 'Show loading animations and transitions' },
                      { key: 'showTooltips', label: 'Show Tooltips', description: 'Display helpful tooltips on hover' }
                    ].map(({ key, label, description }) => (
                      <div key={key} className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>{label}</Label>
                          <p className="text-sm text-muted-foreground">{description}</p>
                        </div>
                        <Switch
                          checked={settings.data[key as keyof typeof settings.data] as boolean}
                          onCheckedChange={(checked) =>
                            updateSetting('data', key, checked)
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label>Refresh Interval: {settings.data.refreshInterval} seconds</Label>
                    <p className="text-sm text-muted-foreground">How often to auto-refresh data when enabled</p>
                    <Slider
                      value={[settings.data.refreshInterval]}
                      onValueChange={([value]) => updateSetting('data', 'refreshInterval', value)}
                      max={300}
                      min={10}
                      step={10}
                      className="w-full"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Storage & Privacy Settings */}
            {activeTab === 'storage' && settings && (
              <>
                <Card className="bg-card border-border p-6 shadow-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Storage & Privacy</h3>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-4">
                      {[
                        { key: 'rememberWalletAddress', label: 'Remember Wallet Address', description: 'Save connected wallet address for quick access' },
                        { key: 'rememberFilters', label: 'Remember Filters', description: 'Save filter preferences between sessions' },
                        { key: 'clearCacheOnReload', label: 'Clear Cache on Reload', description: 'Clear all cached data when refreshing the page' }
                      ].map(({ key, label, description }) => (
                        <div key={key} className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>{label}</Label>
                            <p className="text-sm text-muted-foreground">{description}</p>
                          </div>
                          <Switch
                            checked={settings.storage[key as keyof typeof settings.storage] as boolean}
                            onCheckedChange={(checked) =>
                              updateSetting('storage', key, checked)
                            }
                          />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <Label>Export Data Format</Label>
                      <Select
                        value={settings.storage.exportDataFormat}
                        onValueChange={(value: 'json' | 'csv') =>
                          updateSetting('storage', 'exportDataFormat', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="json">JSON</SelectItem>
                          <SelectItem value="csv">CSV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>

                <Card className="bg-card border-border p-6 shadow-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <h3 className="text-lg font-semibold">Data Management</h3>
                  </div>

                  <div className="space-y-4">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        All data is stored locally in your browser. No data is sent to external servers.
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={handleClearAllData}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All Data
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleClearCache}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Clear Cache Only
                      </Button>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}