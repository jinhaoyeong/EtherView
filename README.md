# EtherView

AI‑powered Ethereum wallet dashboard with wallet overview, transactions, whale tracking, scam detection, and news sentiment. Built with Next.js App Router and TypeScript.

## Features

- Wallet overview with portfolio, token details, and USD conversions
- Transactions view with fees and recent activity
- Whale movements page for large wallet insights
- Scam detection with honeypot simulation and heuristics
- News sentiment analysis with GLM/OpenAI fallback and local heuristics
- Category normalization: Macroeconomic, Geopolitical, Regulation, Technology, Social, Market
- Multi‑sentence article insights for readability
- Cost Saver mode to control API usage (5 vs 10 articles)
- Settings for theme, language, currency, refresh, and privacy

## Getting Started

- Prerequisites: Node.js 18+, npm 9+
- Install:
  ```bash
  npm install
  ```
- Run:
  ```bash
  npm run dev
  ```
  - App runs at http://localhost:3000

## Environment

Configure in `.env.local` (as available):
- `OPENAI_API_KEY`, `GLM_API_KEY`, `GLM_BASE_URL`
- `NEXT_PUBLIC_NEWS_API_KEY` or `NEWSAPI_API_KEY`
- `COINGECKO_API_KEY`, `CRYPTOCOMPARE_API_KEY`, `CURRENTS_API_KEY`
- `TWITTER_BEARER_TOKEN`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`
- Optional: `DISABLE_CRYPTOPANIC`

## Scripts

- `npm run dev` — start development server
- `npm run build` — build production assets
- `npm run start` — run production server
- `npm run lint` — run ESLint
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
- Deployment: `vercel.json`, `next.config.ts` are present; Vercel‑friendly
- Security: do not commit secrets; configure `.env.local`
