## Root Causes
- Whitelist majors sometimes return zero from CoinGecko batch during rate limits.
- Alternates (Coinbase/CryptoCompare) require symbol mapping; WETH needs ETH price, WBTC needs BTC.
- Stablecoins (USDC/USDT/DAI) should be 1.00 USD but external APIs may lag.

## Fixes to Implement
### 1) Provider Mapping
- Map whitelist addresses → canonical symbols:
  - WETH → ETH, WBTC → BTC.
  - Stablecoins: USDC/USDT/DAI → fixed 1.00 USD when providers fail.
- Extend `src/lib/config/tokenWhitelist.ts` with canonicalSymbol.

### 2) Proxy Fill Logic
- In `src/app/api/price-proxy/route.ts`:
  - After CoinGecko batch, fill missing whitelist entries using symbol mapping:
    - Stablecoins: set `{usd: 1, source: 'fixed'}` if alternates fail.
    - WETH/WBTC: use Coinbase/CryptoCompare with mapped symbols.
  - Keep cooldowns and log provider + latency.

### 3) Client Resilience
- In `src/lib/api/priceCache.ts`:
  - If proxy returns 0 for a whitelist address:
    - Apply canonical mapping and fetch alternates directly (Coinbase/CryptoCompare) or fixed price for stablecoins.
  - Batch path: proxy first; for missing entries, try direct CoinGecko, then alternates; cache with `source`.

### 4) Verification
- Reload a wallet holding WETH, USDC, DAI, LINK:
  - Prices should appear; stablecoins show $1.00, WETH shows ETH price, WBTC shows BTC price.
  - UI continues to show tokens even if a provider is cooling down.

### 5) Notes
- No new API keys are required beyond your existing `ETHERSCAN_API_KEY` and `ALCHEMY_API_KEY`.
- This fixes pricing correctness rather than just displaying placeholders.

If approved, I will implement the mapping, proxy/client fallbacks, and verify with your wallet.