"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DarkModeToggle } from "@/components/shared/dark-mode-toggle";
import {
  AlertTriangle,
  Brain,
  ArrowRight,
  Search,
  CheckCircle,
  Zap,
  Eye,
  BarChart3,
  Newspaper
} from "lucide-react";
import { DocumentationModal } from "./documentation-modal";

interface LandingPageProps {
  onWalletConnect: (address: string) => void;
}

export function LandingPage({ onWalletConnect }: LandingPageProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    { address: "0x1234567890123456789012345678901234567890", label: "Demo Wallet - Mixed Portfolio" },
    { address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", label: "Demo Wallet - High Risk" },
    { address: "0xfedcbafedcbafedcbafedcbafedcbafedcba", label: "Demo Wallet - Safe Portfolio" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-9 bg-primary rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0"></div>
            <span className="text-xl font-bold text-foreground">EtherView</span>
          </div>
          <div className="flex items-center space-x-3">
            <DocumentationModal
              trigger={
                <Button variant="ghost" size="sm">
                  Documentation
                </Button>
              }
            />
            <DarkModeToggle />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-screen px-4 pt-24">
        <div className="w-full max-w-6xl">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
              Ethereum
              <span className="text-primary"> Intelligence</span> Dashboard
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              Advanced AI-powered wallet analytics with real-time scam detection.
              Analyze any Ethereum portfolio for risks, track whale movements,
              and get actionable insights.
            </p>

            {/* Stats */}
            <div className="flex items-center justify-center space-x-12 mb-12">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">10M+</div>
                <div className="text-sm text-muted-foreground">Tokens Analyzed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-500">99.9%</div>
                <div className="text-sm text-muted-foreground">Detection Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-500">24/7</div>
                <div className="text-sm text-muted-foreground">Real-time Monitoring</div>
              </div>
            </div>
          </div>

          {/* Main Input Card */}
          <Card className="p-8 shadow-2xl border-border/50 bg-card/95 backdrop-blur-sm mb-12">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  Analyze Any Ethereum Wallet
                </h2>
                <p className="text-muted-foreground">
                  Enter a wallet address to reveal comprehensive portfolio analysis and risk assessment
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <Input
                  type="text"
                  placeholder="Enter Ethereum wallet address (0x...)"
                  value={walletAddress}
                  onChange={handleInputChange}
                  className="pl-12 pr-4 py-4 text-base h-14 border-border/50 bg-muted/50 focus:border-primary focus:ring-primary/20"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full h-14 text-base font-medium"
                disabled={isLoading || !walletAddress.trim()}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground mr-3"></div>
                    Analyzing Wallet...
                  </>
                ) : (
                  <>
                    Analyze Portfolio
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>

            {/* Demo Wallets */}
            <div className="mt-8 pt-8 border-t border-border/50">
              <div className="text-center mb-4">
                <span className="text-sm text-muted-foreground">Try our demo wallets:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {demoWallets.map((demo, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-3 px-3 border-border/50 bg-muted/30 hover:bg-muted/50"
                    onClick={() => setWalletAddress(demo.address)}
                    disabled={isLoading}
                  >
                    <div className="text-left">
                      <div className="font-medium text-foreground truncate">
                        {demo.address.slice(0, 10)}...{demo.address.slice(-8)}
                      </div>
                      <div className="text-muted-foreground truncate">
                        {demo.label}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <Card className="p-6 border-border/50 bg-card/80 backdrop-blur-sm hover:bg-card/90 transition-colors">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold">Scam Detection</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                AI-powered detection of honeypots, rug pulls, and malicious token contracts
                with detailed evidence and risk scoring.
              </p>
            </Card>

            <Card className="p-6 border-border/50 bg-card/80 backdrop-blur-sm hover:bg-card/90 transition-colors">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold">Portfolio Analytics</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Comprehensive portfolio analysis with performance tracking,
                asset allocation, and valuation insights.
              </p>
            </Card>

            <Card className="p-6 border-border/50 bg-card/80 backdrop-blur-sm hover:bg-card/90 transition-colors">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Eye className="h-6 w-6 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold">Whale Tracking</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Monitor large wallet movements and track whale activity
                across the Ethereum network.
              </p>
            </Card>

            <Card className="p-6 border-border/50 bg-card/80 backdrop-blur-sm hover:bg-card/90 transition-colors">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Newspaper className="h-6 w-6 text-purple-500" />
                </div>
                <h3 className="text-lg font-semibold">News Sentiment</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Real-time news analysis and sentiment tracking for market insights,
                influencer monitoring, and trend predictions.
              </p>
            </Card>
          </div>

          {/* Trust Indicators */}
          <div className="text-center">
            <div className="inline-flex items-center space-x-8 text-muted-foreground">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm">Bank-level Security</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-orange-500" />
                <span className="text-sm">Lightning Fast</span>
              </div>
              <div className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-primary" />
                <span className="text-sm">AI-Powered</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}