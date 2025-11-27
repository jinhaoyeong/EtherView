## Issues to Resolve
- Decorator errors: `@cached` causes TypeScript 5 runtime signature mismatch in `lib/ai/whale/whaleEngine.ts:97,129,470,636`.
- Implicit any types: `clusters` is untyped at `lib/ai/whale/whaleEngine.ts:155,195`.
- Incorrect fetch options: `params` is not valid in `fetch` at `lib/ai/whale/whaleEngine.ts:278,293`.
- Possible undefined from `Promise.allSettled`: at `lib/ai/whale/whaleEngine.ts:225,244,533,549,556`.
- Price fallback logs: using cached-only `estimateTokenPrice()` leads to “No cached price found - using fallback”. Should fetch price when cache miss.

## Implementation Plan
### 1) Remove problematic decorators in WhaleEngine
- Replace `@cached(...)` with explicit method-level caching using the existing `cache` helper or a simple in-memory Map keyed by method args.
- Keep API identical (no behavior change), eliminate TS 5 decorator signature issue.

### 2) Fix types and null-safety
- Define `type Cluster = { symbol: string; address: string; totalUSD: number; count: number }` (or minimal fields used) and annotate `clusters` usage.
- Guard `Promise.allSettled` results:
  - Check `status === 'fulfilled' && value?.success` before reading `.value.data`.
  - Provide sensible defaults when not fulfilled.

### 3) Correct fetch usage
- Remove `params` from `fetch` options; build query strings directly into URLs.

### 4) Upgrade price fetching behavior
- In `src/lib/api/wallet.ts`:
  - Replace synchronous `estimateTokenPrice()` usage with an async `ensureTokenPrice(symbol, address)` that:
    - Returns cached price if present; otherwise calls `priceCache.fetchTokenPrice(symbol, address)`.
    - Falls back to stablecoin constants only when network calls fail.
  - Convert the token mapping step to async and await price retrieval.
- In WhaleEngine:
  - Batch price requests with `priceCache.fetchTokenPricesByAddress(addresses)` and assign prices to tokens.
  - For leftover tokens without prices, do a limited on-demand fetch (`fetchTokenPrice`) with a small concurrency limit.

### 5) Verification
- Run dev server; ensure Token Positions shows multiple tokens with prices and no “using fallback” logs for priceable tokens.
- Run TypeScript diagnostics to confirm decorator/type errors are gone.
- Sanity-check rate limiting by observing no 429 logs after batching.

### 6) Configuration
- Ensure `ALCHEMY_API_KEY` is set to enable Alchemy paths. Prices rely on CoinGecko; batching minimizes rate limits automatically.

I will implement these changes, then verify the UI and logs, and ensure WhaleEngine compiles cleanly with no diagnostics.