## Diagnosis
- Proxy returns 200 with empty/missing prices for whitelist tokens, so client marks them as “Price Unavailable”.
- Evidence:
  - Proxy only uses CoinGecko batch and does not fill missing entries with alternate providers for tokens: `src/app/api/price-proxy/route.ts` (no address→symbol fallback logic).
  - Client does not fallback if proxy responds OK but price is 0: `src/lib/api/priceCache.ts:190–206` (returns 0 without trying `fetchTokenPriceDirect` or alternates when address key is missing).
- Result: majors like WETH, USDC, DAI, LINK show “Price Unavailable” despite being whitelisted.

## Fix Plan
### 1) Proxy: Fill missing prices for whitelist tokens
- Map addresses to symbols using `src/lib/config/tokenWhitelist.ts`.
- If CoinGecko batch returns missing addresses or provider is in cool‑down:
  - For each missing whitelist address, call Coinbase (by symbol), then CryptoCompare; set `source`.
- Return a complete map `address→{usd, source}` for all requested addresses, not partial.

### 2) Client: Fallback when proxy returns zero
- In `fetchTokenPrice(symbol, address)`:
  - If proxy price ≤ 0, immediately attempt `fetchTokenPriceDirect(symbol, address)`.
  - If still 0 and token is whitelisted, attempt symbol providers (Coinbase, CryptoCompare) before giving up.
- In `fetchTokenPricesByAddress(addresses)`:
  - First call proxy batch with addresses.
  - For any addresses still 0, call direct CoinGecko per address (short timeout) and then alternates, caching successes with `source`.

### 3) Logging & Cool‑downs
- Proxy: keep/adapt cool‑down state; log provider used and latency; mark 429s and skip provider during cool‑down.
- Client: log when proxy returns zero to ensure visibility; tag cached entries with `source`.

### 4) Verification
- Test with WETH, USDC, DAI, LINK addresses from whitelist:
  - Confirm non‑zero prices and `priceSource` badge shown.
  - Check logs: provider rotation without repeated 429s.

### 5) Non‑Goal but Ready Next
- Optional on‑chain DEX fallback (Uniswap v2/v3 TWAP) for non‑majors; can be added later.

On approval, I’ll implement proxy fallback fills using the whitelist map, update client fallbacks for zero prices, and verify LINK/WETH/USDC/DAI show prices consistently.