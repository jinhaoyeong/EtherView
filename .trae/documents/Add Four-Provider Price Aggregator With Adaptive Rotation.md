## Overview
Align pricing and detection to your preference: use CoinMarketCap for a curated whitelist (top 100), and use CoinGecko + Dexscreener + one more provider to price wallet tokens (including memecoins, airdrops). Rotate providers on rate limits.

## Providers & Roles
- Whitelist (Top 100): CoinMarketCap (CMC) — metadata + price for curated majors
- Wallet tokens (broad coverage):
  - CoinGecko (contract address) — primary token price
  - Dexscreener (on-chain DEX pairs) — memecoins/low-cap pricing via liquidity pools
  - CryptoCompare (symbol) — secondary symbol fallback
  - Coinbase (symbol) — tertiary symbol fallback for majors
- Scam flags:
  - Dexscreener liquidity/volume data (pool age, liquidity size, price impact)
  - Honeypot/tax simulation (existing module keeps working)
  - Airdrop/spam heuristics (already present; apply strong filters to non-whitelist)

## Server Architecture (price-proxy)
- Partitioned routes:
  - `GET /api/price-proxy?type=whitelist&symbols=...` → CMC prices for majors; caches 10 min; requires `COINMARKETCAP_API_KEY`
  - `GET /api/price-proxy?type=token&addresses=...` → rotation:
    1) CoinGecko batch by address
    2) Dexscreener pool price by address (best liquidity pair TWAP)
    3) Symbol fallbacks (CryptoCompare → Coinbase) using whitelist canonical mapping
  - Adaptive cool-downs: per provider; skip when cooling down
  - Queue/throttle: concurrency 4; batch 20–25; short retry once
  - Returns `{ address: { usd, source, confidence } }`

## Whitelist Registry
- Build `src/lib/config/tokenWhitelist.ts` from CMC top 100 at startup (or update periodically):
  - Add `canonicalSymbol` mapping, decimals and verified flag
  - Prefer CMC price for whitelist majors; if CMC rate-limits, rotate to alternates

## Client Integration (priceCache)
- Whitelist pricing path: call CMC proxy route first → fallback to CoinGecko/CryptoCompare/Coinbase
- Wallet token path: proxy first (CG → Dexscreener → CC → Coinbase); if zero price, direct CG per-address, then Dexscreener
- Cache with `source` and `confidence` for UI display; TTL 5–10 min

## Scam Detection Enhancements
- Dexscreener data feed:
  - Mark pools with ultra-low liquidity, recent creation, abnormal price impact
  - Flag as memecoin/airdrop risk; deprioritize pricing unless user expands small balances
- Honeypot/tax simulation: keep fast paths; skip for whitelist majors

## UI
- Always render verified/whitelist tokens; show price source badge (CMC, CoinGecko, Dexscreener, Coinbase, CryptoCompare)
- Memecoin/airdrop tokens show risk banner and liquidity info from Dexscreener

## Keys
- Required: `ETHERSCAN_API_KEY`, `ALCHEMY_API_KEY`
- New: `COINMARKETCAP_API_KEY` (for whitelist prices and metadata)
- Optional: `CRYPTOCOMPARE_API_KEY` (higher limits)

## Verification
- Test with wallets holding WETH, USDC, USDT, DAI, LINK, WBTC, plus 2–3 memecoins
- Confirm majors priced via CMC with fallbacks; memecoins priced via Dexscreener; sources shown; minimal 429s

If approved, I’ll implement the CMC whitelist route, Dexscreener integration, and update rotation and caching accordingly, then verify with your wallet.