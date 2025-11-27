## What I’ll Implement Now
- Use your `COINMARKETCAP_API_KEY` for curated whitelist (top 100) pricing and metadata.
- Rotate wallet token pricing across CoinGecko → Dexscreener → CryptoCompare → Coinbase, with canonical symbol mapping and stablecoin fixes.
- Expand scam detection with Dexscreener liquidity, tax/transfer controls, multi‑router simulation, and external signals.

## Changes (Files)
- `src/app/api/price-proxy/route.ts`
  - Add `GET ?type=whitelist&symbols=...` using CMC; cache 10 min; returns `{ symbol: { usd, source, confidence } }`.
  - Update `GET ?type=token&addresses=...` rotation: CG batch → Dexscreener pool price → CC/Coinbase symbol → stablecoin fixed fallback; include `source`+`confidence`.
- `src/lib/providers/cmc.ts`
  - CMC quotes fetch and normalization; header `X-CMC_PRO_API_KEY: process.env.COINMARKETCAP_API_KEY`.
- `src/lib/providers/dexscreener.ts`
  - Fetch best-liquidity pair for an address (`/latest/dex/tokens/<address>`); price, liquidity USD, pool age, lock status.
- `src/lib/config/tokenWhitelist.ts`
  - Ensure `canonicalSymbol` and `fixedUSD` present; add util to return top symbols for CMC fetch.
- `src/lib/api/priceCache.ts`
  - Whitelist path: call proxy `type=whitelist` first; fallbacks on failure.
  - Wallet path: proxy-first; then direct CG per address → Dexscreener → symbol fallbacks; cache 5–10 min.
- `lib/ai/scam/types.ts`
  - Add `liquidityInfo`, `controlsInfo`, `simulationResults`, `externalSignals`.
- `lib/ai/scam/scamFeatures.ts`
  - Static code controls, Dexscreener liquidity risk, holder distribution excluding LP/routers, mint/burn spikes, external signals; risk scoring with confidence and reasons.
- `lib/ai/scam/honeypotSimulator.ts`
  - Multi‑router buy/sell (Uniswap v2/v3, Sushi, 1inch); revert capture; fee/tax estimation.

## Caching & Limits
- Provider cooldowns on 429/non‑200 (30–60s).
- Concurrency 4; batch 20–25; single retry.
- Cache prices 5–10 min; metadata 24 h.

## Verification
- Test wallets with WETH, USDC, USDT, DAI, LINK, WBTC and memecoins.
- Confirm majors priced via CMC (source badge), memecoins priced via Dexscreener, scam flags show liquidity/tax/simulation, minimal 429 loops.

I’ll start implementing immediately using your new key and report back with verification results.