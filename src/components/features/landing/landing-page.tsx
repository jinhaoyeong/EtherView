"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DarkModeToggle } from "@/components/shared/dark-mode-toggle";
import {
  AlertTriangle,
  ArrowRight,
  Search,
  Eye,
  BarChart3,
  Newspaper,
  ShieldCheck,
  Activity
} from "lucide-react";
import { DocumentationModal } from "./documentation-modal";
import { useTranslation } from "@/hooks/use-translation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LandingPageProps {
  onWalletConnect: (address: string) => void;
}

export function LandingPage({ onWalletConnect }: LandingPageProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useTranslation();

  // Ethereum address validation
  const isValidEthereumAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!walletAddress.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    if (!isValidEthereumAddress(walletAddress)) {
      setError("Please enter a valid Ethereum address (0x...)");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call to validate and load wallet data
      await new Promise(resolve => setTimeout(resolve, 1500));
      onWalletConnect(walletAddress);
      // Navigate to overview page
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wallet data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setWalletAddress(value);

    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  // Demo wallet addresses for testing
  const demoWallets = [
    { address: "0x1234567890123456789012345678901234567890", label: "Mixed Portfolio" },
    { address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", label: "High Risk" },
    { address: "0xfedcbafedcbafedcbafedcbafedcbafedcba", label: "Safe Portfolio" }
  ];

  const demoWhaleAddress = "0x075e72a5edf65f0a5f44699c7654c1a76941ddc8";

  const connectDemoWhale = async () => {
    setError(null);
    if (!isValidEthereumAddress(demoWhaleAddress)) {
      setError("Demo whale address is invalid");
      return;
    }
    try {
      setIsLoading(true);
      setWalletAddress(demoWhaleAddress);
      await new Promise(resolve => setTimeout(resolve, 500));
      onWalletConnect(demoWhaleAddress);
      // Navigate to overview page
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect demo whale wallet");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[bottom_1px_center] dark:bg-grid-slate-400/[0.05] dark:bg-bottom dark:border-b dark:border-slate-100/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/0 pointer-events-none" />
      
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-30 dark:opacity-50 mix-blend-multiply dark:mix-blend-normal" />
      <div className="absolute top-40 -left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl opacity-30 dark:opacity-50 mix-blend-multiply dark:mix-blend-normal" />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <Eye className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">EtherView</span>
          </div>
          <div className="flex items-center space-x-4">
            <DocumentationModal
              trigger={
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground font-medium">
                  Documentation
                </Button>
              }
            />
            <DarkModeToggle />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-20">
        <div className="w-full max-w-5xl mx-auto text-center space-y-10">
          
          {/* Hero Section */}
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
              v2.0 Now Live
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground">
              Master Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
                Ethereum Portfolio
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Real-time analytics, AI-powered scam detection, and whale tracking. 
              The most powerful way to visualize your on-chain activity.
            </p>
          </div>

          {/* Main Input Section */}
          <div className="w-full max-w-3xl mx-auto mt-16 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <Card className="relative p-3 bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl">
                <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-grow">
                    <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-6 w-6" />
                    <Input
                      type="text"
                      placeholder={t('landing.placeholder')}
                      value={walletAddress}
                      onChange={handleInputChange}
                      className="pl-14 pr-4 h-16 text-lg border-transparent bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
                      disabled={isLoading}
                    />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="submit"
                        size="lg"
                        className="h-16 px-10 text-lg font-medium rounded-xl shadow-lg hover:shadow-primary/25 transition-all duration-300"
                        disabled={isLoading || !walletAddress.trim()}
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground"></div>
                            <span>{t('landing.scanning')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>{t('landing.analyze')}</span>
                            <ArrowRight className="h-5 w-5" />
                          </div>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('landing.analyze_tooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </form>
              </Card>
            </div>

            {error && (
              <Alert variant="destructive" className="mt-6 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="h-5 w-5" />
                <AlertDescription className="text-base">{error}</AlertDescription>
              </Alert>
            )}

          {/* Quick Access Pills */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 animate-in fade-in duration-1000 delay-200">
            <span className="text-base text-muted-foreground mr-2">{t('landing.demo')}</span>
            {demoWallets.map((demo, index) => (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setWalletAddress(demo.address)}
                    className="px-4 py-1.5 text-sm font-medium rounded-full bg-muted/50 hover:bg-muted border border-transparent hover:border-primary/20 transition-all text-muted-foreground hover:text-foreground"
                  >
                    {demo.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('landing.demo')} {demo.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={connectDemoWhale}
                  className="px-4 py-1.5 text-sm font-medium rounded-full bg-muted/50 hover:bg-muted border border-transparent hover:border-primary/20 transition-all text-muted-foreground hover:text-foreground"
                >
                  {t('landing.best_demo')}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('landing.best_demo')}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-12 max-w-4xl mx-auto pt-12 animate-in fade-in duration-1000 delay-300">
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-foreground">10M+</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">{t('landing.stats.analyzed')}</div>
            </div>
            <div className="text-center space-y-2 border-x border-border/50">
              <div className="text-4xl font-bold text-foreground">99.9%</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">{t('landing.stats.accuracy')}</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-foreground">24/7</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">{t('landing.stats.realtime')}</div>
            </div>
          </div>
        </div>

        {/* Features Strip */}
        <div className="w-full max-w-7xl mx-auto mt-20 pt-10 border-t border-border/40 animate-in fade-in duration-1000 delay-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center p-6 hover:bg-muted/30 rounded-2xl transition-colors">
              <div className="p-3 bg-red-500/10 rounded-xl mb-4 text-red-500">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h3 className="font-bold mb-2 text-lg">{t('landing.features.scam')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.features.scam_desc')}</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 hover:bg-muted/30 rounded-2xl transition-colors">
              <div className="p-3 bg-blue-500/10 rounded-xl mb-4 text-blue-500">
                <BarChart3 className="h-8 w-8" />
              </div>
              <h3 className="font-bold mb-2 text-lg">{t('landing.features.analytics')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.features.analytics_desc')}</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 hover:bg-muted/30 rounded-2xl transition-colors">
              <div className="p-3 bg-green-500/10 rounded-xl mb-4 text-green-500">
                <Activity className="h-8 w-8" />
              </div>
              <h3 className="font-bold mb-2 text-lg">{t('landing.features.whale')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.features.whale_desc')}</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 hover:bg-muted/30 rounded-2xl transition-colors">
              <div className="p-3 bg-purple-500/10 rounded-xl mb-4 text-purple-500">
                <Newspaper className="h-8 w-8" />
              </div>
              <h3 className="font-bold mb-2 text-lg">{t('landing.features.sentiment')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.features.sentiment_desc')}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full text-center py-8 text-sm text-muted-foreground animate-in fade-in duration-1000 delay-700">
          <p>© {new Date().getFullYear()} EtherView. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
