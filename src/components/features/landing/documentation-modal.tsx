"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const views = [
  {
    title: "Portfolio",
    text: "Observed balances, token positions, and allocation. Estimates use available USD quotes and exclude unpriced assets.",
  },
  {
    title: "Transactions & large transfers",
    text: "Transfer records for the selected wallet. The large-transfer view filters the available history by estimated value; it is not a network-wide feed.",
  },
  {
    title: "Token risk review",
    text: "Contract signals and heuristic findings. A recognized contract or low risk score does not establish safety or sellability.",
  },
  {
    title: "Ethereum briefing",
    text: "Collected articles and available sentiment analysis. Sentiment describes content and is not a price forecast.",
  },
];

export function DocumentationModal({ trigger }: { trigger: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-lg p-6 sm:max-w-2xl sm:p-8">
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Using EtherView
          </DialogTitle>
          <DialogDescription className="mt-2 leading-relaxed">
            A read-only dashboard for public Ethereum addresses.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="start" className="mt-3">
          <TabsList className="h-auto w-full justify-start rounded-lg bg-muted p-1">
            <TabsTrigger value="start" className="rounded-lg">
              Getting started
            </TabsTrigger>
            <TabsTrigger value="views" className="rounded-lg">
              Dashboard sections
            </TabsTrigger>
            <TabsTrigger value="data" className="rounded-lg">
              Data & coverage
            </TabsTrigger>
          </TabsList>
          <TabsContent value="start" className="mt-6">
            <ol className="divide-y divide-border">
              {[
                {
                  title: "Enter an address",
                  text: "Use a full Ethereum address: 0x followed by 40 hexadecimal characters. Public examples are available on the home page. ENS names are not resolved by the search field.",
                },
                {
                  title: "Review the records",
                  text: "Open the portfolio, then use the navigation to review transfers, token risks, and news. Links to block explorers let you check source records.",
                },
                {
                  title: "Adjust your preferences",
                  text: "Settings controls the theme, display options, refresh intervals, and whether this browser remembers the last viewed address.",
                },
              ].map(({ title, text }, index) => (
                <li key={title} className="flex gap-4 py-5 first:pt-0">
                  <span className="pt-0.5 font-mono text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-medium">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              Looking up an address does not connect a wallet or request a
              signature. Never enter a seed phrase or private key.
            </p>
          </TabsContent>
          <TabsContent value="views" className="mt-6">
            <dl className="divide-y divide-border">
              {views.map(({ title, text }) => (
                <div key={title} className="py-4 first:pt-0">
                  <dt className="text-sm font-medium">{title}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {text}
                  </dd>
                </div>
              ))}
            </dl>
          </TabsContent>
          <TabsContent
            value="data"
            className="mt-6 space-y-5 text-sm leading-relaxed text-muted-foreground"
          >
            <section>
              <h3 className="mb-2 font-medium text-foreground">
                Provider availability
              </h3>
              <p>
                Blockchain, market, and news integrations depend on
                configuration, rate limits, and network access. Some sources
                require API keys set by the app operator. Missing records or a
                missing price do not confirm an empty wallet or a worthless
                asset.
              </p>
            </section>
            <section>
              <h3 className="mb-2 font-medium text-foreground">
                Quotes and interpretation
              </h3>
              <p>
                Records may be cached, delayed, or incomplete. USD estimates are
                not executable trade quotes. Risk scores and sentiment can be
                wrong; review the source records and supporting evidence.
              </p>
            </section>
            <section>
              <h3 className="mb-2 font-medium text-foreground">
                Data requests
              </h3>
              <p>
                Public wallet and token addresses are sent to configured data
                providers. Preferences and an optionally remembered address are
                saved in your browser.
              </p>
            </section>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-2 text-primary"
            >
              Data & privacy
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
