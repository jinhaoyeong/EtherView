## Diagnosis
- UI shows “Price Unavailable” because the proxy returns `{ usd: 0 }` for many addresses.
- Browser logs confirm client-side direct CoinGecko calls were previously failing; we have already switched to proxy-only pricing, but the proxy still returns zeros when providers miss (CG/Dexscreener) and whitelist symbols aren’t applied at batch time.

## Fix Plan
### 1) CMC Batch Fallback for Majors
- In `src/app/api/price-proxy/route.ts` (`type=token`):
  - After CoinGecko and Dexscreener fills, compute `stillMissing`.
  - Map `stillMissing` addresses to whitelist canonical symbols (e.g., WETH→ETH, WBTC→BTC) using `WHITELIST_MAINNET`.
  - Call `getWhitelistQuotes(symbols)` (CMC) once and fill `result` for those addresses, set `source: 'cmc'`, `confidence: 0.95`.
  - Cache these entries in `tokenCache` (5–10 min TTL).

### 2) On‑Chain TWAP Fallback for Non‑Majors
- Add `src/lib/providers/uniswap.ts` with a helper to compute a price from the best WETH pair:
  - Find pair via Dexscreener and fetch reserves; compute TWAP or spot (with a short window) to derive USD via WETH.
  - If Dexscreener doesn’t have a pair, skip TWAP.
- In proxy `type=token`, if an address is still missing and not whitelisted, attempt TWAP; if success, set `source: 'twap'`, `confidence: 0.6`.

### 3) Proxy Hygiene and Logging
- Ensure imports are top-level only; remove any bottom-of-file import.
- Add clear logs for provider selection and latencies: CG batch, Dexscreener, CMC batch, TWAP.

### 4) Client Cache Alignment
- `src/lib/api/priceCache.ts`: batch path already uses proxy-only; keep caching `source` and `confidence`.
- Suppress any residual direct CoinGecko calls; we’ve already removed these.

### 5) Verification
- Restart dev server to load `.env.local` keys.
- Call proxy endpoints:
  - `GET /api/price-proxy?type=token&addresses=<LINK>,<UNI>` → returns non-zero usd with `source`.
  - `GET /api/price-proxy?type=whitelist&symbols=LINK,UNI` → returns CMC values.
- Load wallet with majors and memecoins; confirm prices and value populate and source badges display.

## Keys
- Required: `ALCHEMY_API_KEY`, `ETHERSCAN_API_KEY` (already present), `COINMARKETCAP_API_KEY` (present)
- Optional: `CRYPTOCOMPARE_API_KEY` for higher symbol rate limits (proxy already uses it when present)

## Outcome
- Proxy will return non-zero prices for whitelist majors via CMC batch when CG/Dexscreener miss.
- Non-majors will be covered by TWAP when providers don’t return, significantly reducing “Price Unavailable” cases.
- UI shows prices and values consistently with provider `source` and `confidence` tags.