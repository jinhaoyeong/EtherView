"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ResearchHeader } from "@/components/shared/research-header";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useWallet } from "@/contexts/wallet-context";

const sections = [
  {
    number: "01",
    title: "Public address lookups",
    paragraphs: [
      "EtherView uses public Ethereum addresses to retrieve balances, token positions, transfers, and related analysis. It does not request a wallet signature, private key, or seed phrase.",
      "Blockchain records are public, but looking up an address may reveal information about your interests. Viewing an address does not establish that you own it.",
    ],
  },
  {
    number: "02",
    title: "External data providers",
    paragraphs: [
      "Wallet and token addresses are included in requests to configured RPC, explorer, portfolio, and market data providers. Depending on the integration, requests pass through the app’s server or go directly to a provider.",
      "News and analysis features request content and send analysis inputs to configured services. Providers and the hosting environment may receive ordinary request metadata. Their processing and retention depend on their own policies and configuration.",
    ],
  },
  {
    number: "03",
    title: "Browser storage and caches",
    paragraphs: [
      "Preferences such as theme, language, display options, and refresh behavior are saved in this browser. If “Remember wallet address” is enabled, the last viewed public address is saved on this device.",
      "The app caches data to reduce repeated requests. Some caches live in memory or server processes. Clearing browser data does not erase blockchain records or data held by external providers.",
    ],
  },
  {
    number: "04",
    title: "Local data controls",
    paragraphs: [
      "Settings → Privacy & storage lets you disable address remembrance, clear saved EtherView cache entries, export preferences, or remove EtherView’s saved local data.",
      "Removing EtherView data resets its saved preferences and address. It does not remove unrelated browser storage. You can also manage site data through your browser’s settings.",
    ],
  },
];

export default function PrivacyPage() {
  const { walletAddress, handleDisconnect } = useWallet();
  return (
    <DashboardLayout
      walletAddress={walletAddress || ""}
      onDisconnect={handleDisconnect}
    >
      <div className="workspace-page research-page space-y-8">
        <ResearchHeader
          index="07"
          category="Built on transparency"
          title="Data & privacy"
          description="Your keys stay yours. Here’s what EtherView reads, what it remembers, and what you control."
          tone="lilac"
        />
        <div className="privacy-composition">
          <article className="privacy-chapters">
            {sections.map(({ number, title, paragraphs }) => (
              <section
                key={number}
                className="privacy-chapter"
              >
                <span className="privacy-chapter-index">
                  {number}
                </span>
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    {title}
                  </h2>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                    {paragraphs.map((text) => (
                      <p key={text}>{text}</p>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </article>
          <aside className="space-y-4 text-sm">
            <section className="surface-panel p-5">
              <h2 className="mb-2 font-medium">Public addresses only</h2>
              <p className="leading-relaxed text-muted-foreground">
                A private key or seed phrase is never needed to look up an
                address.
              </p>
            </section>
            <section className="surface-panel p-5">
              <h2 className="mb-2 font-medium">Browser preferences</h2>
              <p className="mb-4 leading-relaxed text-muted-foreground">
                Manage remembered addresses, saved preferences, and cache
                entries.
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 text-primary"
              >
                Open settings
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
