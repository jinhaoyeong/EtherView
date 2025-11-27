## Findings
- `net::ERR_ABORTED http://localhost:3000/whale?_rsc=...` is a client-side navigation/prefetch abort typically triggered when the route isn’t present or prefetch is interrupted; it’s harmless if a valid page exists but indicates the `/whale` page may be missing or Link prefetch is misbehaving.
- Multiple `net::ERR_FAILED` errors from CoinGecko token price endpoints suggest the browser is attempting cross-origin price fetches (likely hitting CORS/rate limits). These should be server-side with caching and fallbacks, not direct client calls.

## Plan
### 1) Whale Page Navigation
- Verify `/app/whale/page.tsx` exists.
- If missing, create a minimal page that consumes whale movement data from the analysis API.
- Disable Link prefetch for `/whale` to prevent aborted prefetch noise: set `prefetch={false}` on the Link.

### 2) Server-Side Price Fetching & Caching
- Update `src/lib/api/priceCache.ts` to avoid direct browser fetch to CoinGecko:
  - If running in browser (`typeof window !== 'undefined'`), route to an internal proxy endpoint `/api/token-price`.
  - If server-side, fetch CoinGecko directly with robust error handling.
- Add an internal API route `/api/token-price` that fetches prices server-side, sets appropriate cache headers (e.g., 60–300s), and returns `priceUSD` map. This avoids CORS and centralizes rate-limit retries.
- Implement exponential backoff and graceful fallbacks:
  - On failure, set `priceUSD = 0`, mark tokens `hasNoPriceData = true`, and log `warn` instead of `error`.

### 3) Analysis Route & UI Integration
- Ensure `src/app/api/analyze-wallet/route.ts` uses `priceCache` server-side and never triggers CoinGecko from the browser.
- In the UI (`enhanced-overview.tsx`), rely on analyzed portfolio data for prices and only display `Price Unavailable` when `hasNoPriceData` is set; do not call CoinGecko directly from the client.

### 4) Validation
- Reload dev server.
- Navigate to `/whale` and confirm no `ERR_ABORTED`. If the page exists, the abort logs should disappear or reduce when prefetch is off.
- Load a wallet and ensure no `ERR_FAILED` CoinGecko logs in the browser. Prices should appear or show `Price Unavailable` without errors.
- Confirm overview and scam detection remain accurate with server-side price caching.

### Files to Update
- `src/lib/api/priceCache.ts` (browser guard, proxy routing, backoff)
- `src/app/api/token-price/route.ts` (new proxy route)
- `src/components/...` where Link to `/whale` is rendered (disable prefetch)
- `src/app/whale/page.tsx` if route is missing (minimal page)

If you approve, I will implement the server-side proxy, guard browser calls, and adjust the whale navigation to eliminate these errors while keeping the overview and scam detection intact.