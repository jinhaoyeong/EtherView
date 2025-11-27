"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  AlertTriangle,
  Eye,
  BarChart3,
  HelpCircle,
  Lock,
  TrendingUp
} from "lucide-react";

export function DocumentationModal({ trigger }: { trigger: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            EtherView Documentation
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="getting-started" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
          </TabsList>

          <TabsContent value="getting-started" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Quick Start Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">1. Connect Your Wallet</h4>
                  <p className="text-sm text-muted-foreground">
                    Enter any Ethereum wallet address (starting with 0x...) in the input field and click &quot;Analyze Portfolio&quot;.
                    You can use one of our demo wallets to explore the features.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">2. Understand the Dashboard</h4>
                  <p className="text-sm text-muted-foreground">
                    The dashboard provides comprehensive analysis across 5 main tabs: Overview, Transactions,
                    Whale Movement, Scam Token Alert, and News Sentiment.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">3. Navigate Between Tabs</h4>
                  <p className="text-sm text-muted-foreground">
                    Use the left sidebar to switch between different analysis views. Each tab provides
                    unique insights into your wallet&apos;s performance and security.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    Portfolio Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Comprehensive portfolio analysis with real-time data and insights.
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>• Total balance and asset allocation</li>
                    <li>• Historical performance charts</li>
                    <li>• Individual token position tracking</li>
                    <li>• 24-hour change indicators</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-green-500" />
                    Whale Movement Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Monitor large transfers that could impact market prices.
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>• Real-time whale detection (≥$1M transfers)</li>
                    <li>• Exchange inflow/outflow analysis</li>
                    <li>• Market impact estimation</li>
                    <li>• AI-generated insights and explanations</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Scam Detection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Advanced AI-powered detection of risky and malicious tokens.
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>• Honeypot and rug pull detection</li>
                    <li>• Contract security analysis</li>
                    <li>• Risk scoring with confidence levels</li>
                    <li>• Detailed evidence and explanations</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-orange-500" />
                    News & Sentiment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    AI-analyzed market sentiment and news aggregation.
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>• Real-time news feed from multiple sources</li>
                    <li>• Sentiment analysis (Bullish/Neutral/Bearish)</li>
                    <li>• Influencer and social media monitoring</li>
                    <li>• Market trend predictions with confidence</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Security & Privacy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">🔐 Data Protection</h4>
                  <p className="text-sm text-muted-foreground">
                    We never store your private keys or sensitive information. All wallet addresses
                    are processed securely and anonymously.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">🛡️ API Security</h4>
                  <p className="text-sm text-muted-foreground">
                    All data is fetched from reputable sources (Etherscan, CoinGecko) using secure
                    API connections with rate limiting and error handling.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">⚡ Best Practices</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Never share your private keys</li>
                    <li>• Use hardware wallets for large amounts</li>
                    <li>• Double-check transaction details before signing</li>
                    <li>• Keep your software updated</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="faq" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Frequently Asked Questions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">How accurate is the scam detection?</h4>
                  <p className="text-sm text-muted-foreground">
                    Our AI models achieve 99.9% detection accuracy with comprehensive evidence.
                    However, always do your own research before making investment decisions.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">What data sources do you use?</h4>
                  <p className="text-sm text-muted-foreground">
                    We aggregate data from Etherscan, CoinGecko, multiple news APIs, and social media
                    platforms to provide comprehensive analysis.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">How often is data updated?</h4>
                  <p className="text-sm text-muted-foreground">
                    Market data is updated in real-time, news analysis runs continuously, and
                    portfolio data refreshes every 5 minutes.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Why is my token flagged as high risk?</h4>
                  <p className="text-sm text-muted-foreground">
                    Tokens are flagged based on multiple factors including contract security,
                    liquidity patterns, holder distribution, and transfer restrictions.
                    Check the evidence panel for detailed reasoning.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}