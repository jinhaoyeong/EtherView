## Summary
Integrate CoinMarketCap for curated whitelist (top 100) pricing and metadata, rotate wallet token pricing across CoinGecko → Dexscreener → CryptoCompare → Coinbase, and expand scam detection with liquidity, tax/transfer controls, simulation, and external signals. Keep caching and adaptive cooldowns to avoid rate limits and ensure majors always price.

## Keys
- Required: `ETHERSCAN_API_KEY`, `ALCHEMY_API_KEY`
- New: `COINMARKETCAP_API_KEY` (for whitelist pricing/metadata)
- Optional: `CRYPTOCOMPARE_API_KEY` (higher symbol-rate limits)

## Server: Price Proxy
- Route: `src/app/api/price-proxy/route.ts`
  - Add `GET ?type=whitelist&symbols=SYM1,SYM2,...` (CMC):
    - Use `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=...` with header `X-CMC_PRO_API_KEY`.
    - Return `{ symbol: { usd, source: 'cmc', confidence } }` and cache 10 minutes.
  - Update `GET ?type=token&addresses=...` rotation:
    1) CoinGecko batch by address
    2) Dexscreener pool price by address (`https://api.dexscreener.com/latest/dex/tokens/<address>` → pick best-liquidity pair TWAP)
    3) Symbol fallbacks: CryptoCompare → Coinbase (use whitelist canonical mapping, e.g., WETH→ETH, WBTC→BTC)
    4) Stablecoin fixed fallback (`fixedUSD = 1`) when all providers fail
  - Adaptive provider cooldowns on 429/non-200 (e.g., 30–60s)
  - Concurrency cap (4), batch size (20–25), single retry per provider
  - Include `source` and `confidence` in responses; log provider choice and latency

## Providers Modules
- Add `src/lib/providers/cmc.ts`:
  - Functions: `getWhitelistQuotes(symbols: string[])`, response normalization and caching
- Add `src/lib/providers/dexscreener.ts`:
  - `getTokenPairs(address: string)`: returns best pair price, liquidity USD, pair age, lock status
  - Normalization for proxy and scam features
- Extend whitelist registry `src/lib/config/tokenWhitelist.ts`:
  - Add `canonicalSymbol` (WETH→ETH, WBTC→BTC) and `fixedUSD` for stablecoins
  - Utility: `getTopSymbols()` for CMC queries

## Client: Price Cache
- Update `src/lib/api/priceCache.ts`:
  - Whitelist path: call proxy `?type=whitelist&symbols=...` for majors; fallback to CoinGecko/CryptoCompare/Coinbase on failure
  - Wallet token path: proxy-first; if zero, try direct CoinGecko per-address, then Dexscreener, then symbol fallbacks; cache 5–10 min with `source` and `confidence`
  - Batch path: proxy → fill missing via direct CoinGecko → Dexscreener → cache with source

## Scam Detection Enhancements
- Types: `lib/ai/scam/types.ts`
  - Add `liquidityInfo`, `controlsInfo`, `simulationResults`, `externalSignals` with typed fields (pool age/liquidity/lock, fees/maxTx/maxWallet/blacklist, buy/sell success and tax estimate, reputation data)
- Feature extraction: `lib/ai/scam/scamFeatures.ts`
  - Static code parsing for Ownable/AccessControl/Upgradeable/Pausable/Fee Manager; detect trading gates and dynamic taxes; hidden owner privileges; proxy upgradability flags
  - Liquidity via Dexscreener (pool age, liquidity USD, lock status, LP unlock schedule) → rug risk
  - Holder distribution excluding LP/routers; flag dev wallets
  - Transactions: mint/burn spikes, straight-line inflows, bot-like micro swaps
  - External signals: Honeypot.is, Etherscan labels, Chainabuse/CryptoScamDB
  - Risk scoring with weights and confidence band; reasons + recommended actions
  - Whitelist bypass remains (skip heavy scans)
- Simulator: `lib/ai/scam/honeypotSimulator.ts`
  - Multi-router buy/sell (Uniswap v2/v3, Sushi, 1inch) with revert capture; fee/tax estimation; typical slippage and gas limits

## Shared Fetchers
- `lib/ai/shared/fetcher.ts`: add rate-limit aware wrappers for Dexscreener, CMC, Honeypot.is, Chainabuse; short timeouts; one retry; provider cooldowns

## UI
- `src/components/features/portfolio/enhanced-overview.tsx`:
  - Ensure verified/whitelist tokens render even when price is unavailable; show `priceSource` and (optionally) `confidence`
  - Scam panel shows Dexscreener liquidity, lock, and simulation sellability

## Verification
- Set `COINMARKETCAP_API_KEY` in `.env.local`; restart dev server
- Test with wallets holding WETH, USDC, USDT, DAI, LINK, WBTC and a few memecoins
- Confirm:
  - Majors priced via CMC with source badge; fallbacks engage on rate-limit
  - Memecoins priced via Dexscreener with liquidity info
  - Scam detection flags honeypots/tax gates and shows simulation results
  - Minimal 429 loops thanks to rotation and cooldowns

## Rollout & Safety
- Progressive integration behind proxy; all clients call proxy-first
- Strong caching and provider cooldowns
- No secrets logged; stable error handling with safe fallbacks
