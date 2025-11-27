## Root Causes
- Whale movements derived only from ~15 recent transactions; high threshold ($1M) excludes most large transfers.
- Token analysis restricted to tokens with `valueUSD > 0` → ignores tokens lacking price data; overview shows only 2 tokens.
- Pre-filter scam detector runs only on tokensWithValues; tokens without price never analyzed/flagged.
- Overview replaces full token list with `safeTokens` only; flagged/no-price tokens disappear from the portfolio section.

## Fix Plan
### 1) Whale Movements
- Increase transaction scope: fetch multiple pages or higher `offset` (e.g., page 1–3, `offset=200`) before calling `detectWhaleMovements`.
- Lower threshold to detect large flows: use `$100k` (or configurable) instead of `$1M`.
- Include token transfer USD values and ETH transfers together; aggregate within the analyzed window.
- Keep analytics lightweight: cache transaction pages for 2–5 minutes; cap movements to top 50 by `valueUSD`.

### 2) Token Coverage in API Route (`src/app/api/analyze-wallet/route.ts`)
- Build `allWalletTokens` from `portfolioData.tokens` without filtering on `valueUSD`. Track `hasNoPriceData`.
- Pre-filter scam tokens over the full token set (not only `valueUSD > 0`).
- For scam analysis, create two lists:
  - `trustedTokens`: skip deep analysis
  - `tokensToAnalyze`: all non-trusted tokens, including no-price tokens
- Analyze up to 50 tokens (configurable) with progress logging; include tokens with missing price.
- Do not remove flagged tokens entirely from `portfolio.tokens`; instead:
  - Keep `portfolio.tokens` as full list (safe + flagged + no price) for completeness
  - Add fields `verifiedCount`, `flaggedCount`, `noPriceCount` for UI summaries

### 3) Overview UI (`src/components/features/portfolio/enhanced-overview.tsx`)
- Show a richer initial token list:
  - Include tokens with `hasNoPriceData` when balance is non-trivial
  - Provide toggle to reveal all tokens (already present) but default to include top N no-price tokens
- Ensure balances are formatted (e.g., 6 decimals) and render `Price Unavailable` for missing price.
- Keep ETH insertion logic consistent with ETH units and computed `ethValueUSD`.

### 4) Performance & Safety
- Token contract filtering stays in `WalletAPI.fetchTopTokensOnly`:
  - Keep major/DeFi tokens
  - Filter obvious spam (single-tx + spammy name/long symbol)
  - Cap to top ~60 contracts by activity
  - Fetch balances in chunks of 10 with short timeouts
- Price prefetch limited to top ~20; others marked `hasNoPriceData`.
- Add configuration knobs (thresholds, pages, caps) via constants for quick tuning.

### 5) Validation
- Run dev server and load your whale wallet; observe:
  - Whale Movements section displays multiple events and aggregated stats
  - Overview tokens include more entries, including no-price tokens
  - Scam alert lists more than one flagged token; counts align with overview
- Inspect logs to confirm pages fetched, thresholds applied, and analysis counts

### Files to Update
- `src/app/api/analyze-wallet/route.ts` (expand tokens and whale detection inputs; preserve full portfolio token list)
- `src/lib/api/wallet.ts` (transaction pages & whale movement threshold; keep spam filtering heuristics)
- `src/components/features/portfolio/enhanced-overview.tsx` (include no-price tokens in default view)

I will implement these changes and verify with your wallet to ensure whale movements are visible and the overview/scam sections reflect the complete holdings accurately.