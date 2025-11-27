## Changes
- Route all token and ETH pricing through `/api/price-proxy`; eliminate direct client calls to CoinGecko or other providers.
- Keep server-side provider rotation (CoinGecko → Dexscreener → CryptoCompare → Coinbase, CMC for whitelist) with cooldowns and caching.

## Files
- `src/lib/api/priceCache.ts`
  - `fetchTokenPrice`: proxy-first; if zero, try `type=whitelist` then proxy per-address; remove direct CoinGecko fallback.
  - `fetchTokenPriceDirect`: replace with a proxy request per-address or whitelist symbol; no external calls from client.
  - `fetchTokenPricesByAddress`: proxy batch first; for missing addresses, call proxy per-address; remove direct CoinGecko batch from client.
  - `fetchETHPrice`: keep proxy and alternates (Coinbase/CryptoCompare); remove direct CoinGecko fallback.

## Outcome
- Browser no longer makes CORS-sensitive requests to provider APIs.
- Server proxy handles rotation, caching and keys; reduces "Price Unavailable" and `ERR_FAILED` logs.

## Verification
- Restart dev server; load wallet with majors + memecoins.
- Confirm prices have `source` badges and no client-side provider errors in the console.