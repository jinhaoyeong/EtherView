## Root Cause
- Client `useEffect` triggers `WalletAPI.analyzeWallet('/api/analyze-wallet')` in dev Strict Mode, mounting effects twice and aborting the first request.
- The aborted request throws and is logged as an error, producing:
  - `net::ERR_ABORTED /api/analyze-wallet`
  - "Failed to analyze wallet: TypeError: Failed to fetch"
  - "❌ Failed to load real portfolio data: Error: Failed to fetch"

## Changes (Client)
1. Add AbortController to `WalletAPI.analyzeWallet`
- Accept optional `signal`, pass to `fetch('/api/analyze-wallet', { method: 'POST', cache: 'no-store', keepalive: true, signal })`.
- Treat `AbortError` (and network aborts) as non-fatal: return `{ success: false, error: 'aborted', data: null }` without `console.error`.

2. Wire abort in `EnhancedOverview`
- In `loadRealPortfolioData`, create `AbortController`, pass `signal` to `WalletAPI.analyzeWallet`.
- Add `useEffect` cleanup `controller.abort()`; if error is aborted, silently ignore and skip error logging.
- Keep existing loading and data setting logic unchanged for successful runs.

3. Retry once on transient failures
- In `WalletAPI.analyzeWallet`, add a single retry (100–300ms backoff) only when the error is not an `AbortError`.
- Continue to avoid noisy logs; use `console.warn` only on the final failure.

## Changes (Server)
4. Ensure the API route is fast and stable (already good)
- No signature changes; confirm `POST` handler quickly returns basic analysis and defers heavy work to background.

## Verification
- Navigate to Overview; expect no `net::ERR_ABORTED` errors and no "Failed to fetch" logs.
- Trigger a re-render (toggle sidebar, route change) to confirm aborted requests are swallowed and do not surface errors.
- Confirm data still loads correctly and cache behavior remains intact.

## Notes
- This keeps the dev DX clean by ignoring expected aborts in Strict Mode, without masking real failures.
- No API semantics change; only client-side request lifecycle management and silent handling of aborts.