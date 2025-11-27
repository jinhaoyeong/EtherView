"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useWallet } from "@/contexts/wallet-context";
import { Card } from "@/components/ui/card";
import { Shield, Eye, Database, UserCheck } from "lucide-react";

export default function PrivacyPage() {
  const { walletAddress, handleDisconnect } = useWallet();

  return (
    <DashboardLayout walletAddress={walletAddress || ''} onDisconnect={handleDisconnect}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">How we protect your data and maintain your privacy</p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card className="bg-card border-border p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Data Collection</h3>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                EtherView is designed with your privacy in mind. We only collect the minimum data necessary to provide our services:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Wallet address (publicly visible on blockchain)</li>
                <li>Token balances and transaction history (public blockchain data)</li>
                <li>Application usage analytics (anonymous and aggregated)</li>
              </ul>
            </div>
          </Card>

          <Card className="bg-card border-border p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Database className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Data Storage</h3>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                We handle your data with the utmost care:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>No private keys or sensitive data are ever stored</li>
                <li>All data is encrypted in transit and at rest</li>
                <li>Local storage is used only for session management</li>
                <li>You can clear all stored data at any time</li>
              </ul>
            </div>
          </Card>

          <Card className="bg-card border-border p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <UserCheck className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Your Rights</h3>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                You have complete control over your data:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Access all your stored data on request</li>
                <li>Delete your data at any time</li>
                <li>Opt out of analytics tracking</li>
                <li>Export your data in portable formats</li>
              </ul>
            </div>
          </Card>

          <Card className="bg-card border-border p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Third-Party Services</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                We use the following third-party services to provide our features:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Alchemy API - for blockchain data access</li>
                <li>CoinGecko API - for token price information</li>
                <li>News providers - for sentiment analysis (with your consent)</li>
              </ul>
              <p className="mt-4">
                These services have their own privacy policies and we ensure they comply with our standards.
              </p>
            </div>
          </Card>

          <Card className="bg-card border-border p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                If you have any questions about our privacy practices or want to exercise your rights, please contact us:
              </p>
              <div className="space-y-2">
                <p><strong>Email:</strong> privacy@etherview.io</p>
                <p><strong>GitHub:</strong> github.com/etherview</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}