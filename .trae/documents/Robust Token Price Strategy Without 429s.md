## Scope
- Finish multi‑provider price rotation to eliminate 429s and ensure majors (e.g., LINK) always have prices.
- Add a centralized whitelist registry to bypass heavy scans for known majors and reduce API calls.

## Price Aggregator (Server Route)
- Create `src/app/api/price-proxy/route.ts`:
  - Providers: CoinGecko (contract address batch), Coinbase (symbol), CryptoCompare (symbol), On‑chain DEX price (Uniswap v2/v3 WETH pool TWAP for fallback).
  - Rotation:
    1) Try CoinGecko batch for addresses (batch=25, 2500–5000 ms timeout).
    2) If 429 or failure: mark provider cool‑down (e.g., 30–60 s); skip during cool‑down.
    3) For majors, race Coinbase and CryptoCompare concurrently; take first success, cancel other.
    4) If both fail, compute on‑chain price; cache result.
  - Queue/throttle: single in‑memory queue (FIFO) with max concurrency (e.g., 4) and per‑provider backoff.
  - Caching: per address/symbol (TTL 5–10 min); provider health cache (TTL 30–60 s) tracking 429s.
  - Logging: provider chosen, latency, rate-limit/cool‑down events.

## Client Integration (priceCache)
- Update `src/lib/api/priceCache.ts`:
  - Use proxy first (address batch for holdings; hedged race for ETH/majors).
  - If proxy fails: direct CoinGecko address → Coinbase → CryptoCompare → on‑chain fallback.
  - Cache aggressively per address/symbol (5–10 min); avoid re‑pricing same address in session.

## Discovery Enhancements (wallet)
- `src/lib/api/wallet.ts`:
  - Primary: Alchemy `getTokenBalances(address)`.
  - Fallback: Etherscan V2 `tokentx` up to 5 pages (1000 tx) when `< 5` tokens found; then V2 `tokenbalance` on those contracts.
  - Dedupe by contract; prioritize whitelist + top by balance for pricing; batch price calls via proxy.

## Global Whitelist (Bypass Scans)
- Add `src/lib/config/tokenWhitelist.ts`:
  - Map: `chainId → { address: { symbol, name, decimals, verified: true } }` for majors: WETH, USDC, USDT, DAI, LINK, UNI, AAVE, MKR, WBTC, LDO, COMP, etc.
  - Re‑export/merge existing `ETHEREUM_TOKEN_WHITELIST`.
- Apply whitelist:
  - Scam detector (`lib/ai/scam/scamFeatures.ts`): skip heavy code/holder scans for whitelist unless `forceScan=true`.
  - Whale/scam background: don’t run holder analysis or code verification for whitelist; mark `verified=true`.
  - Token discovery: bypass spam heuristics for whitelist tokens.

## UI Improvements
- `src/components/features/portfolio/enhanced-overview.tsx`:
  - Auto‑expand small‑balance section when overview shows `< 5` tokens (done); ensure price source badge shows (e.g., “Coinbase”, “CryptoCompare”) using `token.priceSource` from proxy.
  - Keep ETH injection only when `tokens.length === 0`.

## Efficiency & Caching
- Session cache TTL: prices 5–10 min; token metadata 24 h.
- Provider health/cool‑down cache: 30–60 s on 429.
- No duplicate pricing of same address in session.

## Verification
- Load a wallet with LINK and multiple ERC‑20s; confirm LINK price and more tokens listed.
- Check logs for provider rotation without repeated 429s; confirm whitelist tokens are marked `verified` and skipped by scam heavy scans.

## Files to Implement/Update
- `src/app/api/price-proxy/route.ts` (new aggregator route)
- `src/lib/api/priceCache.ts` (proxy-first rotation + fallbacks, caching)
- `src/lib/api/wallet.ts` (Alchemy primary + Etherscan V2 fallback to 5 pages; whitelist prioritization)
- `src/lib/config/tokenWhitelist.ts` (new registry)
- `lib/ai/scam/scamFeatures.ts` (skip heavy scans for whitelist)
- `src/components/features/portfolio/enhanced-overview.tsx` (auto-expand + source badges)

If you confirm, I’ll implement the proxy route, whitelist registry, the rotations and cool‑downs, and wire them across wallet/scam/UI paths, then verify with a LINK wallet.