# EtherView

A read-only Ethereum intelligence workspace for public-wallet exploration, asset positions, transactions, large transfers, token risk indicators, and news sentiment. Built with Next.js App Router and TypeScript.

## Features

- Wallet overview with observed portfolio value, allocation, asset search, token details, and USD estimates
- Transactions view with fees and recent activity
- Wallet-relative whale movements from large transfers in available history
- Token risk screening with evidence and heuristics; sell simulation is explicitly unavailable
- News sentiment analysis with GLM/OpenAI fallback and local heuristics
- Category normalization: Macroeconomic, Geopolitical, Regulation, Technology, Social, Market
- Multi‑sentence article insights for readability
- Cost Saver mode to control API usage (5 vs 10 articles)
- Settings for theme, language, currency, refresh, and privacy

## Getting Started

- Prerequisites: a currently supported Node.js LTS release and npm (included with Node.js).
- Install:
  ```bash
  npm ci
  ```
- Run:
  ```bash
  npm run dev
  ```
  - App runs at http://localhost:3000

## Environment

Copy `.env.example` to `.env.local` and fill only the providers you use. Restart the development server after changes. Never put real secrets in committed files.

`ETHERSCAN_API_KEY` is optional for transaction history. Without it, or when Etherscan is unavailable, the server uses public Blockscout history (up to 300 recent records per feed). Public providers may be rate-limited, delayed, or incomplete. Missing data is shown as unavailable; no real sell-simulation provider is configured.

Optional sources:
- `OPENAI_API_KEY`, `GLM_API_KEY`, `GLM_BASE_URL`
- `NEXT_PUBLIC_NEWS_API_KEY` or `NEWSAPI_API_KEY`
- `COINGECKO_API_KEY`, `CRYPTOCOMPARE_API_KEY`, `CURRENTS_API_KEY`
- `TWITTER_BEARER_TOKEN`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`
- Optional: `DISABLE_CRYPTOPANIC`

## Scripts

- `npm run dev` — start development server
- `npm run build` — build production assets
- `npm run start` — run production server
- `npm run lint` — run ESLint (legacy provider/library lint debt remains; see `REVIEW.md`)
- `npm test` — backend correctness and request-validation regression tests
- `npm run typecheck` — TypeScript type checking only

## Pages

- `src/app/page.tsx` — Landing: overview and navigation
- `src/app/whale/page.tsx` — Whale movements, large wallet tracking
- `src/app/scam/page.tsx` — Scam detection and simulation
- `src/app/transactions/page.tsx` — Transaction history and fees
- `src/app/news/page.tsx` — News sentiment and market insights
- `src/app/settings/page.tsx` — Appearance, display, data, storage settings
- `src/app/privacy/page.tsx` — Privacy policy content
- `src/app/not-found.tsx` — 404 fallback

## Core Modules

- Wallet/Portfolio
  - `src/components/features/portfolio/overview.tsx`
  - `src/components/features/portfolio/enhanced-overview.tsx`
  - `src/components/features/portfolio/token-detail-modal.tsx`
  - `src/lib/api/wallet.ts`, `src/lib/api/priceCache.ts`

- Scam Detection
  - `src/lib/ai/scam/scamEngine.ts`, `scamModel.ts`, `scamFeatures.ts`, `scamRules.ts`
  - `src/lib/ai/scam/honeypotSimulator.ts`

- News & Sentiment
  - `src/lib/ai/sentiment/sentimentEngine.ts` — orchestration
  - `src/lib/ai/sentiment/realSentimentAnalyzer.ts` — GLM/OpenAI analysis with robust fallbacks
  - `src/lib/ai/sentiment/newsAggregator.ts` — multi‑source collection and enrichment
  - `src/lib/ai/sentiment/realSocialAggregator.ts` — influencer signals

- Providers & On‑chain
  - `src/lib/providers/cmc.ts`, `dexscreener.ts`
  - `src/lib/eth/multicall.ts`
  - `src/lib/config/tokenWhitelist.ts`

- UI & State
  - `src/components/ui/*` — base components
  - `src/components/layout/*` — layout and header
  - `src/contexts/wallet-context.tsx`, `src/hooks/use-settings.ts`
  - `src/lib/theme-manager.ts`, `src/lib/translations.ts`

## API Routes

- `src/app/api/analyze-wallet/route.ts` — wallet analysis
- `src/app/api/price-proxy/route.ts` — price proxy
- `src/app/api/rpc-proxy/route.ts` — RPC proxy for server-side calls
- `src/app/api/token-stats/route.ts` — token statistics
- `src/app/api/news-sentiment/route.ts` — news & sentiment
- `src/app/api/*-proxy/route.ts` — integrations: covalent, debank, zapper, etherscan, ethplorer

## Cost Saver (News)

- Toggle in News header: `Cost Saver: On/Off`
- On: analyzes top 5 articles; Off: up to 10 articles
- Frontend caps displayed list; backend matches the cap for analysis

## Development Notes

- Type safety: run `npm run typecheck`
- Linting: run `npm run lint`
- Deployment: Cloudflare Workers with vinext; the original Next.js commands remain available.
- Security: do not commit secrets; configure `.env.local`

## Redesign and code review

See [REVIEW.md](REVIEW.md) for the new information architecture, correctness/security fixes, verification, and remaining provider limitations. Valuations are estimates in USD. Recognized contracts are not safety guarantees; sentiment is not a price forecast. The active whale view analyzes the selected wallet, not a global whale feed.

## Cloudflare deployment

Live app: [etherview.yeongjinhao09.workers.dev](https://etherview.yeongjinhao09.workers.dev).

`cloudflare.config.ts` defines the `etherview` Worker and static asset routing. `vite.config.ts` builds the existing Next.js routes with vinext so the server API routes run on Cloudflare alongside the responsive frontend.

```bash
npm run typecheck
npm test
npm run build:vinext
npm run deploy:vinext
```

For CLI deployments, authenticate once with `npx cf auth login`. The initial deployment used the connected Cloudflare account. Local Next.js development still uses `npm run dev`; Cloudflare development uses `npm run dev:vinext`.

Optional provider keys from `.env.example` belong in the Worker's runtime secrets in the Cloudflare dashboard. Public RPC, pricing, and bounded transaction-history fallbacks work without those keys. News availability depends on a configured provider.

When the public explorer rate-limits the hosting provider, browser history lookups retry directly against Blockscout using the same validated, bounded pagination. This fallback sends only the public address and never includes provider credentials.

Next.js and vinext generate different route validator types in `.next/types`. The shared type check excludes the Next.js generated validator and Cloudflare's generated browser-global declarations; the app remains strictly type checked. `next build` performs its own route validation.
