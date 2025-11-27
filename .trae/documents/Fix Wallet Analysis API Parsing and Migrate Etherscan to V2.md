## Issues
- API error: `Unexpected end of JSON input` at `src/app/api/analyze-wallet/route.ts:84` when `await request.json()` is called without a JSON body.
- Etherscan V1 deprecation: token balance calls still hitting V1 (e.g., UNI returns deprecation message). All endpoints must use V2 with `chainid`.
- ETH price 429: CoinGecko rate-limit on ETH price; fallback needed.

## Changes
1) Harden API request parsing
- In `src/app/api/analyze-wallet/route.ts`:
  - Wrap `await request.json()` in try/catch.
  - If JSON parse fails or `Content-Type` isn’t JSON, read `walletAddress` and `timeRange` from URL search params.
  - Validate `walletAddress` format; return 400 with helpful message if invalid.

2) Migrate all Etherscan calls to V2
- Remove any V1 endpoints in wallet token balance paths; use:
  - Base: `https://api.etherscan.io/v2/api`
  - Add `chainid=1` and keep `module/account` actions: `tokentx`, `tokenbalance`, `txlist`, `balance`.
- Ensure `fetchTopTokensOnly` and `getAllTokens` call V2 for both `tokentx` and `tokenbalance` exclusively.

3) Improve ETH price fallback
- If CoinGecko returns 429, fetch from an alternate provider (e.g., CryptoCompare or Coinbase) and cache result.
- Keep short timeouts and session cache to avoid repeated hits.

4) Verification
- Call the API without a body (query params only) and confirm no JSON parse error.
- Confirm token balance logs no longer show V1 deprecation; only V2.
- Check ETH price path logs to verify fallback source used when CoinGecko 429 occurs.
- Run the app and ensure portfolio shows tokens and values.

I will implement these updates, restart the dev server, and verify the UI and logs to ensure the errors are resolved.