## Diagnosis
- The Token Positions table shows only ETH because `fetchTopTokensOnly` returns an empty list and the UI forcibly injects an ETH row.
- Evidence:
  - ETH row injection in `src/components/features/portfolio/enhanced-overview.tsx:500–513`.
  - Token discovery relies on `tokentx` pages (3 pages) + per‑token balance calls. When this finds no contracts or the circuit breaker skips calls, tokens stay empty: `src/lib/api/wallet.ts:513–571, 610–793`.
  - Circuit breaker can skip token balance calls after failures: `src/lib/api/wallet.ts:90–139, 615`.
- Alchemy is already integrated and can fetch ERC‑20 balances directly, but portfolio uses Etherscan path only. Alchemy usage exists in AI modules: `lib/ai/shared/alchemy.ts:160–183`, `lib/ai/whale/whaleEngine.ts`, not in `src/lib/api/wallet.ts`.

## Fix Approach
1. Use Alchemy token balances as the primary source for ERC‑20 holdings.
2. Keep existing Etherscan/DeBank/Zapper logic as fallback.
3. Normalize results to the existing token shape the UI expects and price by contract address.

## Implementation Steps
### 1) Add Alchemy metadata helper
- In `lib/ai/shared/alchemy.ts`, add `getTokenMetadata(contractAddress)` JSON‑RPC method (`alchemy_getTokenMetadata`) returning `name`, `symbol`, `decimals`, `logo`.

### 2) Portfolio token fetch overhaul
- In `src/lib/api/wallet.ts`:
  - Create `fetchTokensFromAlchemy(address)` that:
    - Calls `ALCHEMY_CLIENT.getTokenBalances(address)`.
    - Filters non‑zero `tokenBalance` entries.
    - For entries missing `decimals/symbol/name`, call `getTokenMetadata(contractAddress)`.
    - Convert raw balances using `decimals` to numeric balances.
    - Build the existing token object: `{ symbol, name, address, decimals, balance, priceUSD, valueUSD, verified, hasNoPriceData }`.
    - Price tokens via `priceCache.fetchTokenPrice(symbol, address)` and set `valueUSD`.
  - Update `fetchTopTokensOnly(address)` to:
    - First attempt `fetchTokensFromAlchemy(address)`.
    - If Alchemy returns 0 tokens or throws (no API key / rate limit), fall back to current Etherscan discovery + per‑token balance.
    - Remove circuit‑breaker skip for the Alchemy path; keep it guarding per‑token Etherscan calls only.
    - Ensure dedupe by contract address and sort by `valueUSD`.

### 3) Portfolio summary uses improved tokens
- `fetchPortfolioSummary(address)` should continue calling `fetchTopTokensOnly(address)` and calculate totals. No UI changes needed beyond relying on the improved token list.

### 4) UI adjustments for accuracy
- Keep ETH injection, but only if `tokens.length === 0` or ETH is genuinely missing: `enhanced-overview.tsx:500–513` (no change in behavior, the new data will include tokens so the table won’t be ETH‑only).
- Ensure the positions table shows tokens with `priceUSD === 0` as “Price Unavailable” (already supported).

## Stability & Accuracy Enhancements
- Price by contract address using CoinGecko’s `/simple/token_price` (already implemented in `priceCache.fetchTokenPrice`), avoiding symbol collisions.
- Expand token coverage without depending on recent `tokentx` history; Alchemy returns balances regardless of transfer recency.
- Keep existing circuit breaker but limit it to Etherscan per‑token calls; Alchemy call is one request and more reliable.
- Short timeouts with caching (`@cached` in Alchemy client) prevent UI stalls.

## Verification
- Add a lightweight test run: open a wallet known to hold ERC‑20s; confirm `Token Positions` count > 1 and specific tokens appear.
- Check logs:
  - `fetchPortfolioSummary` shows tokens fetched and total USD (`src/lib/api/wallet.ts:480–496`).
  - Confirm Alchemy path used when Etherscan yields none.
- Validate price formatting and ETH row only appears when there are genuinely no tokens.

## Configuration
- Ensure `ALCHEMY_API_KEY` is set in environment. If missing, the code will gracefully fall back to Etherscan.

If approved, I’ll implement the above changes, wire `ALCHEMY_CLIENT` into `wallet.ts`, and deliver verified results in the UI.