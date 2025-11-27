## Current Workflow
### Data Flow
- Server route `src/app/api/analyze-wallet/route.ts`:
  - Parallel fetch: ETH balance, ETH price, fast portfolio summary (`WalletAPI.fetchPortfolioSummaryFast`) [route.ts:97–111]
  - Transactions aggregation across pages 1–3 [route.ts:116–122]
  - Whale movements via `WalletAPI.detectWhaleMovements` [route.ts:131–133]
  - Scam pre-filter and enhanced analysis producing `allFlaggedTokens` and counts [route.ts:161–556]
  - Final portfolio fields: `ethBalance`, `ethValueUSD`, `totalValueUSD`, `tokens`, counts [route.ts:655–668]
- Client UI `src/components/features/portfolio/enhanced-overview.tsx`:
  - Triggers `WalletAPI.analyzeWallet(walletAddress, '24h')` with abort-safe signal [enhanced-overview.tsx:130]
  - Displays ETH balance/ETH USD [enhanced-overview.tsx:867–871]
  - Token table renders tokens, shows labels for `hasNoPriceData` [enhanced-overview.tsx:1043–1087]
  - Scam alert section uses `aiInsights.scamAnalysis` [enhanced-overview.tsx:1105–1168]
- Wallet API `src/lib/api/wallet.ts`:
  - Fast portfolio summary recomputes `ethValueUSD`, discovers top tokens by value [wallet.ts:444–506]
  - Token discovery with Etherscan pages, chunked balances, price prefetch limited to ~20 [wallet.ts:508–969]
  - Estimate price uses cache and limited stablecoin fallback [wallet.ts:263–305]

### Why Only ~3 Tokens Loaded (Whale Wallets)
- Significant token filter on client: `SIGNIFICANT_TOKENS_THRESHOLD = 50` and slice(0,15) shows a small subset initially [enhanced-overview.tsx:166–211, 219–223].
- Many airdrop/scam tokens have `valueUSD = 0` due to no price; excluded from significant set and only a few with prices appear.
- Price prefetch limits to top ~20 and computed values sort then slice top 15; wallets with many low-value/unpriced tokens surface few items [wallet.ts:917–961].
- If analysis aborts in dev, final `displayTokens` recompute may not replace initial set until retry completes.

### Constraints & Limitations
- External API reliability: CoinGecko failures; Etherscan rate limits.
- No-price tokens: included for visibility but excluded from totals; limited pricing improves UX but can reduce initial token count.
- Dev Strict Mode aborts cause transient emptiness; handled via `AbortController` but network pane still shows "aborted".

## Architecture Review
- Components: `EnhancedOverview` orchestrates display, `TokenDetailModal` for drill-down.
- Data dependencies: server route outputs `portfolio`, `scam`, `whale`, `sentiment`; client consumes and transforms tokens.
- Request/Response: client → `/api/analyze-wallet` POST [wallet.ts:1879–1910], server computes, caches, returns JSON [route.ts:652–671].
- Failure Points:
  - External fetches with timeouts [route.ts:40–61, wallet.ts:313–321].
  - Promise.allSettled must be guarded; server code uses guards [route.ts:104–111, 524–559].
  - Price unavailability; now multi-source ETH and stablecoin fallback for tokens.

## Bugs & Inconsistencies
- Total lower than ETH USD: server previously used stale `totalValueUSD`; fixed by recomputation from ETH USD + tokens [route.ts:655–668].
- Random USD fallback in whale scoring inflated values: corrected to 0 on unknown price [whaleEngine.ts:445–468].
- CoinGecko client calls: moved price reliance server-side and disabled prefetch for heavy routes [sidebar.tsx:168].
- Decorator mismatch and TS diagnostics in WhaleEngine: planned fixes below.

## Enhancements
- Error Handling & Retries:
  - Keep multi-source ETH price and short timeouts, retry once for transient errors.
  - Ensure all PromiseSettled results use optional chaining defaults.
- Token Loading Reliability:
  - Allow a secondary pass to include a capped list of no-price tokens in display (already adds top 10 no-price) and consider a "Show All" interaction using `allTokens` state.
  - Increase price prefetch coverage adaptively for wallets with few priced tokens.
- Data Validation:
  - Validate numeric fields before arithmetic; exclude non-numeric values.
- Caching & State:
  - Maintain short TTL server cache for analysis [route.ts:77–92]; expose cache stats for debugging.

## Quality Assurance
- Test Cases:
  - Wallets with only ETH, with many no-price tokens, with many priced tokens, with mixed assets.
  - Abort handling in dev: ensure UI does not log errors and state remains consistent.
- Monitoring:
  - Log sources and counts; track failure rates by source.
- Performance Benchmarks:
  - Measure route time and token processing counts; assert under target thresholds.
- Alerts:
  - Console warnings on invalid data, rate limits; future integration for server-side monitoring.

## Deliverables
- Technical documentation covering data flow, component interactions, and points of failure.
- Bug report documenting reproduction: stale total vs ETH USD; price unavailability effects; dev abort behavior.
- Enhancement proposal implementing above error handling, token loading, validation, and caching improvements.
- Updated test suite: unit tests for totals (`src/lib/test/portfolio-calculation.test.ts`), expand with wallet scenarios and decorator/caching tests.

## Next Steps
- Implement decorator compatibility and WhaleEngine guards and URL fixes.
- Add scenario tests for whale wallets token loading and scam alerts consistency.
- Produce the technical document and bug report artifacts in the repo or as part of PR description.