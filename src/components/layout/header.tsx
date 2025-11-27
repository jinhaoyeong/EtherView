"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DarkModeToggle } from "@/components/shared/dark-mode-toggle";
import { LogOut, Wallet, ExternalLink, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";

interface HeaderProps {
  walletAddress: string;
  onDisconnect: () => void;
}

export function Header({ walletAddress, onDisconnect }: HeaderProps) {
  const [copied, setCopied] = useState(false);
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const viewOnEtherscan = () => {
    window.open(`https://etherscan.io/address/${walletAddress}`, '_blank');
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <div className="bg-card border-b border-border p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" />
            <span>Analyzing:</span>
          </div>
          <Card className="px-4 py-2 bg-muted border-border">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-sm font-medium text-foreground">
                {formatAddress(walletAddress)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyAddress}
                aria-label="Copy address"
                title="Copy address"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <motion.div
                  animate={copied ? { scale: [1, 1.25, 1], rotate: [0, 12, -12, 0] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </motion.div>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={viewOnEtherscan}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onDisconnect}
            className="flex items-center space-x-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Disconnect</span>
          </Button>

          <DarkModeToggle />
        </div>
      </div>
    </div>
  );
}
